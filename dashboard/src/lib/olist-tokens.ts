/**
 * Utilitário centralizado para leitura, escrita e renovação dos tokens Olist.
 * Usado por: olist/status, olist/callback, olist/vendedores.
 */

import fs from 'fs/promises';
import path from 'path';
import db, { ensureDbInitialized } from './db';

// Determina a raiz do projeto (c:\GitHubLocal\performance)
const isStandalone = process.cwd().includes('.next');
const projectRoot = process.env.PERFORMANCE_SCRIPT_DIR 
  ?? (isStandalone ? path.join(process.cwd(), '../../../../') : path.join(process.cwd(), '..'));

export const TOKEN_FILE = process.env.TOKEN_FILE
  ? path.resolve(process.env.TOKEN_FILE)
  : path.join(projectRoot, '.tiny_tokens.json');

const CLIENT_ID     = process.env.OLIST_CLIENT_ID ?? process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.OLIST_CLIENT_SECRET ?? process.env.CLIENT_SECRET;
const REDIRECT_URI  = process.env.OLIST_REDIRECT_URI ?? 'https://betinalimpeza.ddns.net/performance/api/olist/callback';
const TOKEN_URL     = 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token';
const REQUEST_TIMEOUT_MS = Number(process.env.APP_EXTERNAL_FETCH_TIMEOUT_MS ?? '20000');
const AUTO_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;

function timeoutSignal() {
  return AbortSignal.timeout(
    Number.isFinite(REQUEST_TIMEOUT_MS) && REQUEST_TIMEOUT_MS > 0 ? REQUEST_TIMEOUT_MS : 20000
  );
}

export interface Tokens {
  access_token:  string;
  refresh_token: string | null;
}

export interface OlistCredentials {
  redirect_uri: string | null;
  client_id: string | null;
  client_secret: string | null;
  refresh_token: string | null;
}

type RefreshLog = {
  id: number;
  attempted_at: string;
  attempted_at_local?: string;
  status: 'ok' | 'erro' | 'info';
  message: string;
};

function getCredentialsFromDb(): OlistCredentials {
  ensureDbInitialized();
  const row = db.prepare(`
    SELECT redirect_uri, client_id, client_secret, refresh_token
    FROM olist_credentials
    WHERE id = 1
  `).get() as OlistCredentials | undefined;

  if (!row) return { redirect_uri: null, client_id: null, client_secret: null, refresh_token: null };
  return {
    redirect_uri: row.redirect_uri ?? null,
    client_id: row.client_id ?? null,
    client_secret: row.client_secret ?? null,
    refresh_token: row.refresh_token ?? null,
  };
}

function logRefresh(status: 'ok' | 'erro' | 'info', message: string): void {
  try {
    ensureDbInitialized();
    db.prepare(`
      INSERT INTO token_refresh_logs (attempted_at, status, message)
      VALUES (datetime('now'), ?, ?)
    `).run(status, message);
    db.prepare(`
      DELETE FROM token_refresh_logs
      WHERE attempted_at < datetime('now', '-30 day')
    `).run();
  } catch {}
}

function acquireRefreshLock(): string | null {
  ensureDbInitialized();
  const now = Date.now();
  const lockId = `${now}-${Math.random().toString(16).slice(2)}`;
  const lockedUntil = now + 10 * 60 * 1000;
  const result = db.prepare(`
    INSERT INTO job_locks (name, locked_until, lock_id)
    VALUES (?, ?, ?)
    ON CONFLICT(name) DO UPDATE SET
      locked_until = excluded.locked_until,
      lock_id = excluded.lock_id
    WHERE job_locks.locked_until < ?
  `).run('olist_token_refresh', lockedUntil, lockId, now);
  return result.changes > 0 ? lockId : null;
}

function releaseRefreshLock(lockId: string): void {
  ensureDbInitialized();
  db.prepare('UPDATE job_locks SET locked_until = 0 WHERE name = ? AND lock_id = ?')
    .run('olist_token_refresh', lockId);
}

function getEffectiveCredentials(): { clientId: string | null; clientSecret: string | null } {
  const fromDb = getCredentialsFromDb();
  return {
    clientId: fromDb.client_id?.trim() || CLIENT_ID || null,
    clientSecret: fromDb.client_secret?.trim() || CLIENT_SECRET || null,
  };
}

function normalizeErrorSnippet(raw: string): string {
  const compact = raw.replace(/\s+/g, ' ').trim();
  return compact.length > 240 ? `${compact.slice(0, 240)}...` : compact;
}

export async function readTokens(): Promise<Tokens | null> {
  try {
    const raw = await fs.readFile(TOKEN_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<Tokens>;
    if (!parsed.access_token && !parsed.refresh_token) return null;
    return {
      access_token:  parsed.access_token  ?? '',
      refresh_token: parsed.refresh_token ?? null,
    };
  } catch {
    return null;
  }
}

export async function writeTokens(tokens: Tokens): Promise<void> {
  const tmp = TOKEN_FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(tokens), 'utf-8');
  await fs.rename(tmp, TOKEN_FILE);
  try {
    ensureDbInitialized();
    db.prepare(`
      UPDATE olist_credentials
      SET refresh_token = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(tokens.refresh_token ?? null);
  } catch {}
}

/**
 * Renova o access_token via refresh_token.
 * Retorna o novo access_token ou null se falhar.
 */
export async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const creds = getEffectiveCredentials();
  if (!creds.clientId || !creds.clientSecret) {
    logRefresh('erro', 'Credenciais Olist ausentes para renovação.');
    return null;
  }

  try {
    const body = new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: refreshToken,
    });

    const res = await fetch(TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
      signal: timeoutSignal(),
    });

    if (!res.ok) {
      let detail = '';
      try {
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const errorBody = await res.json() as { error?: string; error_description?: string; message?: string };
          detail = [errorBody.error, errorBody.error_description, errorBody.message].filter(Boolean).join(' | ');
        } else {
          detail = await res.text();
        }
      } catch {}
      const safeDetail = detail ? ` - ${normalizeErrorSnippet(detail)}` : '';
      logRefresh('erro', `Falha HTTP ${res.status} na renovação do token${safeDetail}`);
      return null;
    }

    const data = await res.json() as { access_token?: string; refresh_token?: string };
    if (!data.access_token) {
      logRefresh('erro', 'Resposta inválida da Olist na renovação de token.');
      return null;
    }

    await writeTokens({
      access_token:  data.access_token,
      refresh_token: data.refresh_token ?? refreshToken,
    });

    logRefresh('ok', 'Token renovado com sucesso.');
    return data.access_token;
  } catch {
    logRefresh('erro', 'Erro inesperado na renovação do token.');
    return null;
  }
}

export async function saveOlistCredentials(input: Partial<OlistCredentials>): Promise<void> {
  ensureDbInitialized();
  const current = getCredentialsFromDb();
  const redirectUri = input.redirect_uri !== undefined ? (input.redirect_uri?.trim() || null) : current.redirect_uri;
  const clientId = input.client_id !== undefined ? (input.client_id?.trim() || null) : current.client_id;
  const clientSecret = input.client_secret !== undefined ? (input.client_secret?.trim() || null) : current.client_secret;
  const refreshToken = input.refresh_token !== undefined ? (input.refresh_token?.trim() || null) : current.refresh_token;
  db.prepare(`
    UPDATE olist_credentials
    SET redirect_uri = ?, client_id = ?, client_secret = ?, refresh_token = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(redirectUri, clientId, clientSecret, refreshToken);

  if (input.refresh_token !== undefined && refreshToken) {
    const existing = await readTokens();
    await writeTokens({
      access_token: existing?.access_token ?? '',
      refresh_token: refreshToken,
    });
  }

  logRefresh('info', 'Dados de credenciais Olist atualizados pelo painel.');
}

export function getOlistCredentialsSummary(): {
  redirect_uri: string;
  client_id: string;
  client_secret_set: boolean;
  refresh_token_set: boolean;
  updated_at: string | null;
} {
  ensureDbInitialized();
  const row = db.prepare(`
    SELECT redirect_uri, client_id, client_secret, refresh_token, datetime(updated_at, 'localtime') AS updated_at
    FROM olist_credentials
    WHERE id = 1
  `).get() as { redirect_uri: string | null; client_id: string | null; client_secret: string | null; refresh_token: string | null; updated_at: string | null } | undefined;

  return {
    redirect_uri: row?.redirect_uri ?? '',
    client_id: row?.client_id ?? '',
    client_secret_set: !!row?.client_secret,
    refresh_token_set: !!row?.refresh_token,
    updated_at: row?.updated_at ?? null,
  };
}

export function getOlistCredentialsRaw(): OlistCredentials {
  return getCredentialsFromDb();
}

export function getEffectiveRedirectUri(): string {
  const raw = getCredentialsFromDb().redirect_uri?.trim();
  return raw || REDIRECT_URI;
}

export function getTokenRefreshLogs(limit = 100): RefreshLog[] {
  ensureDbInitialized();
  const safeLimit = Math.max(1, Math.min(limit, 200));
  return db.prepare(`
    SELECT id, attempted_at, datetime(attempted_at, 'localtime') AS attempted_at_local, status, message
    FROM token_refresh_logs
    ORDER BY attempted_at DESC
    LIMIT ?
  `).all(safeLimit) as RefreshLog[];
}

export async function refreshAccessTokenFromStoredConfig(): Promise<string | null> {
  const lockId = acquireRefreshLock();
  if (!lockId) return null;
  try {
    const stored = getCredentialsFromDb();
    const refreshToken = stored.refresh_token || (await readTokens())?.refresh_token || null;
    if (!refreshToken) {
      logRefresh('erro', 'Refresh token ausente para renovação.');
      return null;
    }
    return await refreshAccessToken(refreshToken);
  } finally {
    releaseRefreshLock(lockId);
  }
}

export async function autoRefreshIfDue(): Promise<string | null> {
  ensureDbInitialized();
  const lastOk = db.prepare(`
    SELECT attempted_at
    FROM token_refresh_logs
    WHERE status = 'ok'
    ORDER BY attempted_at DESC
    LIMIT 1
  `).get() as { attempted_at: string } | undefined;

  if (lastOk) {
    const lastTs = new Date(lastOk.attempted_at).getTime();
    if (Number.isFinite(lastTs) && Date.now() - lastTs < AUTO_REFRESH_INTERVAL_MS) return null;
  }
  return await refreshAccessTokenFromStoredConfig();
}

/**
 * Retorna um access_token válido (renovando se necessário).
 * Retorna null se não há tokens ou a renovação falhar.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await readTokens();
  if (!tokens) {
    const renewed = await refreshAccessTokenFromStoredConfig();
    if (renewed) return renewed;
    return null;
  }
  if (tokens.access_token) return tokens.access_token;
  const refreshToken = tokens.refresh_token || getCredentialsFromDb().refresh_token;
  if (!refreshToken) return null;
  return await refreshAccessToken(refreshToken);
}
