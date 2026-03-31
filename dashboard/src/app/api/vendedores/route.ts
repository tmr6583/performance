/**
 * GET  /api/vendedores — lista vendedoras locais
 * POST /api/vendedores — sincroniza lista do Olist (insere novas, preserva e-mails)
 */

import { NextResponse } from 'next/server';
import db, { ensureDbInitialized } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { getValidAccessToken } from '@/lib/olist-tokens';

const API_BASE = 'https://api.tiny.com.br/public-api/v3';

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

  const token = await getValidAccessToken();
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
