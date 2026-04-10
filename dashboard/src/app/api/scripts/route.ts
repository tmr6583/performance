/**
 * POST /api/scripts
 * Dispara fetch_performance.py ou send_emails.py (apenas admin).
 * Body: { acao: 'fetch' | 'send' | 'send_admin_only' | 'fetch_and_send' }
 */

import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { getAuthUser } from '@/lib/auth';
import { isInternalRequest } from '@/lib/scheduler';
import db, { ensureDbInitialized } from '@/lib/db';
import { getOlistCredentialsRaw } from '@/lib/olist-tokens';

const execFileAsync = promisify(execFile);

const VALID_ACOES = ['fetch', 'send', 'send_admin_only', 'fetch_and_send'] as const;
type Acao = (typeof VALID_ACOES)[number];
const shouldLogInfo = process.env.NODE_ENV !== 'production' || process.env.APP_VERBOSE_LOGS === '1';

// Usa variável de ambiente definida no systemd; fallback para ../cwd
const isStandalone = process.cwd().includes('.next');
const ROOT_DIR = process.env.PERFORMANCE_SCRIPT_DIR
  ?? (isStandalone ? path.join(process.cwd(), '../../../../') : path.join(process.cwd(), '..'));

function pythonCmd(): string {
  const isWin = process.platform === 'win32';
  const venvWin = path.join(ROOT_DIR, '.venv', 'Scripts', 'python.exe');
  const venvLin = path.join(ROOT_DIR, '.venv', 'bin', 'python');
  
  if (isWin && fs.existsSync(venvWin)) return venvWin;
  if (!isWin && fs.existsSync(venvLin)) return venvLin;
  
  return isWin ? 'python' : 'python3';
}

function buildPythonEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  const creds = getOlistCredentialsRaw();
  if (creds.client_id) env.CLIENT_ID = creds.client_id;
  if (creds.client_secret) env.CLIENT_SECRET = creds.client_secret;
  if (!env.CLIENT_ID && env.OLIST_CLIENT_ID) env.CLIENT_ID = env.OLIST_CLIENT_ID;
  if (!env.CLIENT_SECRET && env.OLIST_CLIENT_SECRET) env.CLIENT_SECRET = env.OLIST_CLIENT_SECRET;
  
  const configuredSqlitePath = env.SQLITE_DB_PATH?.trim();
  env.SQLITE_DB_PATH = configuredSqlitePath
    ? configuredSqlitePath
    : path.join(ROOT_DIR, 'database.db');

  const configuredTokenFile = env.TOKEN_FILE?.trim();
  env.TOKEN_FILE = configuredTokenFile
    ? configuredTokenFile
    : path.join(ROOT_DIR, '.tiny_tokens.json');
  
  env.PYTHONUNBUFFERED = env.PYTHONUNBUFFERED ?? '1';
  return env;
}

async function runScript(
  scriptName: string,
  options?: { args?: string[]; env?: Partial<NodeJS.ProcessEnv> }
): Promise<{ code: number; output: string }> {
  const scriptPath = path.join(ROOT_DIR, scriptName);
  try {
    const args = [scriptPath, ...(options?.args ?? [])];
    const { stdout, stderr } = await execFileAsync(pythonCmd(), args, {
      cwd:     ROOT_DIR,
      env:     { ...buildPythonEnv(), ...(options?.env ?? {}) },
      timeout: 5 * 60 * 1000, // 5 min
    });
    const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : '');
    if (shouldLogInfo) console.log('Script Output:', output);
    return { code: 0, output };
  } catch (err: unknown) {
    const e = err as { code?: number; stdout?: string; stderr?: string; message?: string };
    const output = (e.stdout ?? '') + (e.stderr ? `\nSTDERR:\n${e.stderr}` : '');
    console.error('Script Error Output:', output || e.message);
    return { code: e.code ?? 1, output: output || e.message || 'Erro desconhecido' };
  }
}

function tryAcquireJobLock(jobName: string, ttlMs: number): { ok: true; lockId: string } | { ok: false } {
  ensureDbInitialized();
  const now = Date.now();
  const lockId = `${now}-${Math.random().toString(16).slice(2)}`;
  const lockedUntil = now + ttlMs;

  const result = db.prepare(
    `
    INSERT INTO job_locks (name, locked_until, lock_id)
    VALUES (?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      locked_until = excluded.locked_until,
      lock_id = excluded.lock_id
    WHERE job_locks.locked_until < ?
    `
  ).run(jobName, lockedUntil, lockId, now);

  return result.changes > 0 ? { ok: true, lockId } : { ok: false };
}

function releaseJobLock(jobName: string, lockId: string): void {
  ensureDbInitialized();
  db.prepare('UPDATE job_locks SET locked_until = 0 WHERE name = ? AND lock_id = ?').run(jobName, lockId);
}

export async function POST(request: Request) {
  const internal = isInternalRequest(request);
  if (!internal) {
    const user = await getAuthUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    }
  }

  const { acao } = (await request.json()) as { acao?: Acao };

  if (!acao || !VALID_ACOES.includes(acao)) {
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  }

  const lock = tryAcquireJobLock('fetch_and_send', 6 * 60 * 1000);
  if (!lock.ok) {
    return NextResponse.json({ error: 'Já existe uma execução em andamento. Aguarde.' }, { status: 409 });
  }
  try {
    if (acao === 'fetch') {
      const result = await runScript('fetch_performance.py');
      revalidatePath('/');
      revalidatePath('/admin');
      return NextResponse.json({ success: result.code === 0, ...result });
    }

    if (acao === 'send') {
      const result = await runScript('send_emails.py');
      return NextResponse.json({ success: result.code === 0, ...result });
    }

    if (acao === 'send_admin_only') {
      const result = await runScript('send_emails.py', {
        env: { SEND_EMAILS_MODE: 'admin_only' },
      });
      return NextResponse.json({ success: result.code === 0, ...result });
    }

    // fetch_and_send: executa sequencialmente
    const fetch = await runScript('fetch_performance.py');
    if (fetch.code !== 0) {
      return NextResponse.json({
        success: false,
        step:    'fetch',
        code:    fetch.code,
        output:  fetch.output,
      });
    }

    const send = await runScript('send_emails.py');
    return NextResponse.json({
      success: send.code === 0,
      step:    'send',
      code:    send.code,
      output:  `[fetch]\n${fetch.output}\n\n[send]\n${send.output}`,
    });
  } finally {
    releaseJobLock('fetch_and_send', lock.lockId);
  }
}
