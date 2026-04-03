/**
 * Utilitário centralizado para leitura, escrita e renovação dos tokens Olist.
 * Usado por: olist/status, olist/callback, olist/vendedores.
 */

import fs from 'fs/promises';
import path from 'path';

// Determina a raiz do projeto (c:\GitHubLocal\performance)
const isStandalone = process.cwd().includes('.next');
const projectRoot = process.env.PERFORMANCE_SCRIPT_DIR 
  ?? (isStandalone ? path.join(process.cwd(), '../../../../') : path.join(process.cwd(), '..'));

export const TOKEN_FILE = process.env.TOKEN_FILE
  ? path.resolve(process.env.TOKEN_FILE)
  : path.join(projectRoot, '.tiny_tokens.json');

const CLIENT_ID     = process.env.OLIST_CLIENT_ID ?? process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.OLIST_CLIENT_SECRET ?? process.env.CLIENT_SECRET;
const TOKEN_URL     = 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token';

export interface Tokens {
  access_token:  string;
  refresh_token: string | null;
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
  // Escrita atômica: grava em arquivo temporário e renomeia
  const tmp = TOKEN_FILE + '.tmp';
  await fs.writeFile(tmp, JSON.stringify(tokens), 'utf-8');
  await fs.rename(tmp, TOKEN_FILE);
}

/**
 * Renova o access_token via refresh_token.
 * Retorna o novo access_token ou null se falhar.
 */
export async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  if (!CLIENT_ID || !CLIENT_SECRET) return null;

  try {
    const body = new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: refreshToken,
    });

    const res = await fetch(TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    });

    if (!res.ok) return null;

    const data = await res.json() as { access_token?: string; refresh_token?: string };
    if (!data.access_token) return null;

    await writeTokens({
      access_token:  data.access_token,
      refresh_token: data.refresh_token ?? refreshToken,
    });

    return data.access_token;
  } catch {
    return null;
  }
}

/**
 * Retorna um access_token válido (renovando se necessário).
 * Retorna null se não há tokens ou a renovação falhar.
 */
export async function getValidAccessToken(): Promise<string | null> {
  const tokens = await readTokens();
  if (!tokens) return null;
  if (tokens.access_token) return tokens.access_token;
  if (!tokens.refresh_token) return null;
  return await refreshAccessToken(tokens.refresh_token);
}
