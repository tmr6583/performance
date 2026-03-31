import { NextResponse } from 'next/server';
import db, { ensureDbInitialized } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  ensureDbInitialized();

  const { id } = await params;
  const idOlist = parseInt(id, 10);
  if (!Number.isFinite(idOlist) || idOlist <= 0) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const exists = db.prepare('SELECT id_olist FROM vendedores WHERE id_olist = ?').get(idOlist);
  if (!exists) {
    return NextResponse.json({ error: 'Vendedora não encontrada' }, { status: 404 });
  }

  const body = (await request.json()) as { email?: unknown; recebe_email?: unknown };

  const email = body.email !== undefined
    ? (typeof body.email === 'string' ? body.email.trim() || null : null)
    : undefined;

  const recebeEmail = body.recebe_email !== undefined
    ? (body.recebe_email ? 1 : 0)
    : undefined;

  if (email !== undefined && recebeEmail !== undefined) {
    db.prepare(
      'UPDATE vendedores SET email = ?, recebe_email = ?, updated_at = CURRENT_TIMESTAMP WHERE id_olist = ?'
    ).run(email, recebeEmail, idOlist);
  } else if (email !== undefined) {
    db.prepare(
      'UPDATE vendedores SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id_olist = ?'
    ).run(email, idOlist);
  } else if (recebeEmail !== undefined) {
    db.prepare(
      'UPDATE vendedores SET recebe_email = ?, updated_at = CURRENT_TIMESTAMP WHERE id_olist = ?'
    ).run(recebeEmail, idOlist);
  }

  return NextResponse.json({ success: true });
}
