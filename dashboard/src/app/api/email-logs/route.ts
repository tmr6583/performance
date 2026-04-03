import { NextResponse } from 'next/server';
import db, { ensureDbInitialized } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  ensureDbInitialized();

  const { searchParams } = new URL(request.url);
  const tipo   = searchParams.get('tipo')   ?? '';
  const status = searchParams.get('status') ?? '';
  const limit  = Math.min(parseInt(searchParams.get('limit')  ?? '50',  10) || 50,  200);
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0',   10) || 0,   0);

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (tipo   === 'vendedora' || tipo   === 'admin') { conditions.push('tipo = ?');   params.push(tipo); }
  if (status === 'ok'        || status === 'erro')  { conditions.push('status = ?'); params.push(status); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = (db.prepare(
    `SELECT count(*) as count FROM email_logs ${where}`
  ).get(...params) as { count: number }).count;

  const rows = db.prepare(
    `SELECT * FROM email_logs ${where} ORDER BY enviado_em DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  return NextResponse.json({ total, rows });
}

export async function DELETE(request: Request) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  ensureDbInitialized();

  try {
    db.prepare('DELETE FROM email_logs').run();
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Erro ao limpar histórico' }, { status: 500 });
  }
}
