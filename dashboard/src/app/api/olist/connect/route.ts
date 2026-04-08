import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import crypto from 'crypto';
import { getEffectiveRedirectUri, getOlistCredentialsRaw } from '@/lib/olist-tokens';

const AUTH_URL = 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth';

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  const storedCreds = getOlistCredentialsRaw();
  const CLIENT_ID = storedCreds.client_id?.trim() || process.env.OLIST_CLIENT_ID;
  const REDIRECT_URI = getEffectiveRedirectUri();

  if (!CLIENT_ID) {
    return NextResponse.json({ error: 'OLIST_CLIENT_ID não configurado' }, { status: 500 });
  }

  // Gera state aleatório para proteção CSRF
  const state = crypto.randomBytes(16).toString('hex');

  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    scope:         'openid',
    response_type: 'code',
    state,
  });

  const response = NextResponse.redirect(`${AUTH_URL}?${params.toString()}`, { status: 302 });

  // Salva state em cookie httpOnly com validade de 5 minutos
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure:   process.env.NODE_ENV === 'production',
    maxAge:   300,
    path:     '/',
  });

  return response;
}
