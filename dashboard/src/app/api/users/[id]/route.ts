import { NextResponse } from 'next/server';
import db, { ensureDbInitialized } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { getAuthUser } from '@/lib/auth';

function resolveId(raw: string | undefined): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser();
  if (!authUser) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });

  ensureDbInitialized();

  const { id } = await params;
  const userId = resolveId(id);
  if (userId == null) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const body = (await request.json()) as {
    password?: unknown; newPassword?: unknown; currentPassword?: unknown;
    recebe_relatorio?: unknown;
    id_olist?: unknown;
  };

  const target = db
    .prepare('SELECT id, role, password FROM users WHERE id = ?')
    .get(userId) as { id: number; role: string; password: string } | undefined;

  if (!target) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

  const isAdmin = authUser.role === 'admin';
  const isSelf  = authUser.id   === userId;

  if (!isAdmin && !isSelf) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  if (body.id_olist !== undefined) {
    if (!isAdmin) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    if (target.role !== 'salesperson') {
      return NextResponse.json({ error: 'id_olist só é permitido para vendedoras' }, { status: 400 });
    }
    const idOlist = typeof body.id_olist === 'number'
      ? body.id_olist
      : typeof body.id_olist === 'string'
        ? parseInt(body.id_olist, 10)
        : null;

    if (idOlist != null && (!Number.isFinite(idOlist) || idOlist <= 0)) {
      return NextResponse.json({ error: 'id_olist inválido' }, { status: 400 });
    }

    db.prepare('UPDATE users SET id_olist = ? WHERE id = ?').run(idOlist, userId);
    return NextResponse.json({ success: true });
  }

  // ── Toggle recebe_relatorio (só admin, só para outros admins) ──────────
  if (body.recebe_relatorio !== undefined) {
    if (!isAdmin) return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
    if (target.role !== 'admin') {
      return NextResponse.json({ error: 'recebe_relatorio só é permitido para administradores' }, { status: 400 });
    }
    db.prepare('UPDATE users SET recebe_relatorio = ? WHERE id = ?').run(
      body.recebe_relatorio ? 1 : 0,
      userId
    );
    return NextResponse.json({ success: true });
  }

  // ── Alteração de senha ─────────────────────────────────────────────────
  const newPassword = typeof body.password === 'string'
    ? body.password
    : typeof body.newPassword === 'string'
      ? body.newPassword
      : '';

  if (!newPassword || newPassword.length < 6) {
    return NextResponse.json({ error: 'A senha deve ter no mínimo 6 caracteres' }, { status: 400 });
  }

  // Se não for admin mudando senha de outro, exige senha atual
  if (!isAdmin || isSelf) {
    const current = typeof body.currentPassword === 'string' ? body.currentPassword : '';
    if (!current) {
      return NextResponse.json({ error: 'Senha atual é obrigatória' }, { status: 400 });
    }
    if (!bcrypt.compareSync(current, target.password)) {
      return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 });
    }
  }

  db.prepare('UPDATE users SET password = ? WHERE id = ?').run(
    bcrypt.hashSync(newPassword, 10),
    userId
  );

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authUser = await getAuthUser();
  if (!authUser || authUser.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  ensureDbInitialized();

  const { id } = await params;
  const userId = resolveId(id);
  if (userId == null) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  if (authUser.id === userId) {
    return NextResponse.json({ error: 'Não é permitido excluir o próprio usuário' }, { status: 400 });
  }

  const target = db
    .prepare('SELECT id, role FROM users WHERE id = ?')
    .get(userId) as { id: number; role: string } | undefined;

  if (!target) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });

  const privileged = new Set(
    (process.env.PRIVILEGED_ADMINS ?? 'admin@empresa.com').split(',').map(e => e.trim())
  );
  if (target.role === 'admin' && !privileged.has(authUser.email)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  if (target.role === 'admin') {
    const count = db
      .prepare("SELECT count(*) as count FROM users WHERE role = 'admin'")
      .get() as { count: number };
    if (count.count <= 1) {
      return NextResponse.json(
        { error: 'Não é permitido excluir o último administrador' },
        { status: 400 }
      );
    }
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(userId);
  return NextResponse.json({ success: true });
}
