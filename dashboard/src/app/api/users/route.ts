import { NextResponse } from 'next/server';
import db, { ensureDbInitialized } from '@/lib/db';
import bcrypt from 'bcryptjs';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  const admin = await getAuthUser();
  if (!admin || admin.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  ensureDbInitialized();

  const users = db
    .prepare('SELECT id, name, email, role, id_olist, recebe_relatorio, created_at FROM users ORDER BY name')
    .all();

  return NextResponse.json(users);
}

export async function POST(request: Request) {
  const admin = await getAuthUser();
  if (!admin || admin.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  ensureDbInitialized();

  const body = (await request.json()) as {
    name?: unknown; email?: unknown; password?: unknown;
  };

  const name     = typeof body.name     === 'string' ? body.name.trim()                : '';
  const email    = typeof body.email    === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password                   : '';
  const role = 'admin';

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Nome, e-mail e senha são obrigatórios' }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'A senha deve ter no mínimo 6 caracteres' }, { status: 400 });
  }

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) {
    return NextResponse.json({ error: 'E-mail já cadastrado' }, { status: 400 });
  }

  const hashed = bcrypt.hashSync(password, 10);
  const info = db.prepare(
    'INSERT INTO users (name, email, password, role, id_olist) VALUES (?, ?, ?, ?, NULL)'
  ).run(name, email, hashed, role);

  return NextResponse.json({ id: info.lastInsertRowid, name, email, role, id_olist: null });
}
