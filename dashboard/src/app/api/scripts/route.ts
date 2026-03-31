/**
 * POST /api/scripts
 * Dispara fetch_performance.py ou send_emails.py (apenas admin).
 * Body: { acao: 'fetch' | 'send' | 'fetch_and_send' }
 */

import { NextResponse } from 'next/server';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { getAuthUser } from '@/lib/auth';
import { isInternalRequest } from '@/lib/scheduler';

const execFileAsync = promisify(execFile);

const VALID_ACOES = ['fetch', 'send', 'fetch_and_send'] as const;
type Acao = (typeof VALID_ACOES)[number];

// Usa variável de ambiente definida no systemd; fallback para ../cwd
const ROOT_DIR = process.env.PERFORMANCE_SCRIPT_DIR
  ?? path.join(process.cwd(), '..');

function pythonCmd(): string {
  const venv = path.join(ROOT_DIR, '.venv', 'bin', 'python');
  return fs.existsSync(venv) ? venv : 'python3';
}

async function runScript(scriptName: string): Promise<{ code: number; output: string }> {
  const scriptPath = path.join(ROOT_DIR, scriptName);
  try {
    const { stdout, stderr } = await execFileAsync(pythonCmd(), [scriptPath], {
      cwd:     ROOT_DIR,
      timeout: 5 * 60 * 1000, // 5 min
    });
    const output = stdout + (stderr ? `\nSTDERR:\n${stderr}` : '');
    return { code: 0, output };
  } catch (err: unknown) {
    const e = err as { code?: number; stdout?: string; stderr?: string; message?: string };
    const output = (e.stdout ?? '') + (e.stderr ? `\nSTDERR:\n${e.stderr}` : '');
    return { code: e.code ?? 1, output: output || e.message || 'Erro desconhecido' };
  }
}

// Controle de execução concorrente
let running = false;

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

  if (running) {
    return NextResponse.json(
      { error: 'Já existe uma execução em andamento. Aguarde.' },
      { status: 409 }
    );
  }

  running = true;
  try {
    if (acao === 'fetch') {
      const result = await runScript('fetch_performance.py');
      return NextResponse.json({ success: result.code === 0, ...result });
    }

    if (acao === 'send') {
      const result = await runScript('send_emails.py');
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
    running = false;
  }
}
