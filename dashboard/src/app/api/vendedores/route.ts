/**
 * GET  /api/vendedores — lista vendedoras locais
 * POST /api/vendedores — sincroniza lista do Olist (insere novas, preserva e-mails)
 */

import { NextResponse } from 'next/server';
import db, { ensureDbInitialized } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { getValidAccessToken, refreshAccessToken, readTokens } from '@/lib/olist-tokens';

const API_BASE = 'https://api.tiny.com.br/public-api/v3';

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  ensureDbInitialized();

  const rows = db.prepare(`
    SELECT v.id_olist, v.nome, v.email, v.recebe_email,
           COALESCE(m.meta_mensal, 0) AS meta_mensal
    FROM vendedores v
    LEFT JOIN metas_vendedores m ON m.id_olist = v.id_olist
    ORDER BY v.nome
  `).all();

  return NextResponse.json(rows);
}

export async function POST() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  ensureDbInitialized();

  let token = await getValidAccessToken();
  if (!token) {
    return NextResponse.json(
      { error: 'Olist desconectado. Clique em "Conectar ao Olist" primeiro.' },
      { status: 400 }
    );
  }

  // Busca todas as páginas de vendedores
  let offset   = 0;
  let total    = 1;
  const todos: { id: number; nome: string; email: string | null }[] = [];

  while (offset < total) {
    let res = await fetch(
      `${API_BASE}/vendedores?limit=100&offset=${offset}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.status === 401) {
      const current = await readTokens();
      if (current?.refresh_token) {
        const refreshed = await refreshAccessToken(current.refresh_token);
        if (refreshed) {
          token = refreshed;
          res = await fetch(
            `${API_BASE}/vendedores?limit=100&offset=${offset}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }
      }
    }
    if (!res.ok) break;
    const data = await res.json() as {
      itens?: { id: number; situacao: string; contato?: { nome?: string; email?: string } }[];
      paginacao?: { total?: number };
    };
    total = data.paginacao?.total ?? 0;
    for (const v of data.itens ?? []) {
      if (v.situacao === 'A' || v.situacao === 'B') {
        const rawEmail = typeof v.contato?.email === 'string' ? v.contato.email.trim().toLowerCase() : '';
        const email = rawEmail && rawEmail.includes('@') ? rawEmail : null;
        todos.push({ id: v.id, nome: v.contato?.nome ?? `Vendedor ${v.id}`, email });
      }
    }
    offset += 100;
  }

  let inseridos = 0;
  for (const v of todos) {
    const exists = db.prepare('SELECT id_olist, email FROM vendedores WHERE id_olist = ?').get(v.id) as
      | { id_olist: number; email: string | null }
      | undefined;
    if (!exists) {
      db.prepare(
        'INSERT INTO vendedores (id_olist, nome, email, recebe_email) VALUES (?, ?, ?, 0)'
      ).run(v.id, v.nome, v.email);
      inseridos++;
    } else {
      // Atualiza nome (pode ter mudado), preserva e-mail e toggle
      db.prepare('UPDATE vendedores SET nome = ? WHERE id_olist = ?').run(v.nome, v.id);
      if ((!exists.email || !String(exists.email).trim()) && v.email) {
        db.prepare('UPDATE vendedores SET email = ? WHERE id_olist = ?').run(v.email, v.id);
      }
    }
  }

  return NextResponse.json({
    success: true,
    total:   todos.length,
    novos:   inseridos,
    ja_existentes: todos.length - inseridos,
  });
}
