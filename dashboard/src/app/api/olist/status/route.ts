import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { readTokens, refreshAccessToken } from '@/lib/olist-tokens';

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  const tokens = await readTokens();

  if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
    return NextResponse.json({ status: 'disconnected' });
  }

  if (!tokens.refresh_token) {
    return NextResponse.json({ status: 'disconnected' });
  }

  if (!process.env.OLIST_CLIENT_ID || !process.env.OLIST_CLIENT_SECRET) {
    return NextResponse.json({ status: 'unknown', reason: 'Credenciais não configuradas' });
  }

  const newToken = await refreshAccessToken(tokens.refresh_token);
  if (newToken) {
    return NextResponse.json({ status: 'connected' });
  }

  return NextResponse.json({ status: 'expired' });
}
