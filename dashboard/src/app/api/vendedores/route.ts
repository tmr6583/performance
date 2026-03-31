/**
 * GET  /api/vendedores — lista vendedoras locais
 * POST /api/vendedores — sincroniza lista do Olist (insere novas, preserva e-mails)
 */

import { NextResponse } from 'next/server';
import db, { ensureDbInitialized } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import path from 'path';
import fs from 'fs';

const TOKEN_FILE    = path.join(process.cwd(), '..', '.tiny_tokens.json');
const CLIENT_ID     = process.env.OLIST_CLIENT_ID;
const CLIENT_SECRET = process.env.OLIST_CLIENT_SECRET;
const TOKEN_URL     = 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token';
const API_BASE      = 'https://api.tiny.com.br/public-api/v3';

async function getAccessToken(): Promise<string | null> {
  if (!fs.existsSync(TOKEN_FILE)) return null;
  try {
    const tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8')) as
      { access_token?: string; refresh_token?: string };

    if (!tokens.refresh_token || !CLIENT_ID || !CLIENT_SECRET) return tokens.access_token ?? null;

    const body = new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
    });

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) return null;

    const newTokens = await res.json() as { access_token?: string; refresh_token?: string };
    if (newTokens.access_token) {
      fs.writeFileSync(TOKEN_FILE, JSON.stringify({
        access_token:  newTokens.access_token,
        refresh_token: newTokens.refresh_token ?? tokens.refresh_token,
      }));
      return newTokens.access_token;
    }
  } catch { /* */ }
  return null;
}

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  ensureDbInitialized();

  const rows = db.prepare(
    'SELECT id_olist, nome, email, recebe_email FROM vendedores ORDER BY nome'
  ).all();

  return NextResponse.json(rows);
}

export async function POST() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  ensureDbInitialized();

  const token = await getAccessToken();
  if (!token) {
    return NextResponse.json(
      { error: 'Olist desconectado. Clique em "Conectar ao Olist" primeiro.' },
      { status: 400 }
    );
  }

  // Busca todas as páginas de vendedores
  let offset   = 0;
  let total    = 1;
  const todos: { id: number; nome: string }[] = [];

  while (offset < total) {
    const res = await fetch(
      `${API_BASE}/vendedores?limit=100&offset=${offset}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) break;
    const data = await res.json() as {
      itens?: { id: number; situacao: string; contato?: { nome?: string } }[];
      paginacao?: { total?: number };
    };
    total = data.paginacao?.total ?? 0;
    for (const v of data.itens ?? []) {
      if (v.situacao === 'A' || v.situacao === 'B') {
        todos.push({ id: v.id, nome: v.contato?.nome ?? `Vendedor ${v.id}` });
      }
    }
    offset += 100;
  }

  let inseridos = 0;
  for (const v of todos) {
    const exists = db.prepare('SELECT id_olist FROM vendedores WHERE id_olist = ?').get(v.id);
    if (!exists) {
      db.prepare(
        'INSERT INTO vendedores (id_olist, nome, email, recebe_email) VALUES (?, ?, NULL, 0)'
      ).run(v.id, v.nome);
      inseridos++;
    } else {
      // Atualiza nome (pode ter mudado), preserva e-mail e toggle
      db.prepare('UPDATE vendedores SET nome = ? WHERE id_olist = ?').run(v.nome, v.id);
    }
  }

  return NextResponse.json({
    success: true,
    total:   todos.length,
    novos:   inseridos,
    ja_existentes: todos.length - inseridos,
  });
}
