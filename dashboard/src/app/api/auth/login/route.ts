import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db, { ensureDbInitialized } from '@/lib/db';
import { signToken } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: unknown; password?: unknown };
    const email    = typeof body.email    === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 });
    }

    ensureDbInitialized();

    const user = db
      .prepare('SELECT id, email, role, name, password FROM users WHERE email = ?')
      .get(email) as
        | { id: number; email: string; role: 'admin' | 'salesperson'; name: string; password: string }
        | undefined;

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });
    const response = NextResponse.json({ success: true, role: user.role });

    response.cookies.set('auth_token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 8,
      path: '/',
    });

    return response;
  } catch (err) {
    console.error('[LOGIN ERROR]', err);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
