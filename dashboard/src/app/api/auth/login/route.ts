import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db, { ensureDbInitialized } from '@/lib/db';
import { signToken } from '@/lib/auth';
import { resolveBasePath } from '@/lib/base-path';

function getClientIp(request: Request): string {
  const xfwd = request.headers.get('x-forwarded-for');
  if (xfwd) return xfwd.split(',')[0]?.trim() || 'unknown';
  return request.headers.get('x-real-ip') ?? 'unknown';
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: unknown; password?: unknown };
    const email    = typeof body.email    === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail e senha são obrigatórios' }, { status: 400 });
    }

    ensureDbInitialized();

    const ip = getClientIp(request);
    const now = Date.now();
    const row = db.prepare(
      'SELECT count, locked_until, updated_at FROM login_attempts WHERE email = ? AND ip = ?'
    ).get(email, ip) as { count: number; locked_until: number; updated_at: number } | undefined;

    if (row && row.locked_until > now) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Tente novamente em alguns minutos.' },
        { status: 429 }
      );
    }

    const user = db
      .prepare('SELECT id, email, role, name, password FROM users WHERE email = ?')
      .get(email) as
        | { id: number; email: string; role: 'admin' | 'salesperson'; name: string; password: string }
        | undefined;

    if (!user || !bcrypt.compareSync(password, user.password)) {
      const prevCount = row && row.updated_at + 15 * 60 * 1000 > now ? row.count : 0;
      const nextCount = prevCount + 1;
      const lockedUntil = nextCount >= 10 ? now + 15 * 60 * 1000 : 0;
      db.prepare(
        `
        INSERT INTO login_attempts (email, ip, count, locked_until, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(email, ip) DO UPDATE SET
          count = excluded.count,
          locked_until = excluded.locked_until,
          updated_at = excluded.updated_at
        `
      ).run(email, ip, nextCount, lockedUntil, now);
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
    }

    db.prepare('DELETE FROM login_attempts WHERE email = ? AND ip = ?').run(email, ip);

    const token = signToken({ id: user.id, email: user.email, role: user.role, name: user.name });
    const response = NextResponse.json({ success: true, role: user.role });

    const basePath = resolveBasePath();
    if (basePath && basePath !== '/') {
      // Limpa cookie legado com escopo de basePath para evitar conflito de leitura.
      response.cookies.set('auth_token', '', { maxAge: 0, path: basePath });
    }
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
