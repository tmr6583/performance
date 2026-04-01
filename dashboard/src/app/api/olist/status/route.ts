import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { readTokens, refreshAccessToken } from '@/lib/olist-tokens';

let lastCheckAt = 0;
let lastStatus: { status: string; reason?: string } | null = null;

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  const now = Date.now();
  if (lastStatus && now - lastCheckAt < 60_000) {
    return NextResponse.json(lastStatus);
  }

  const tokens = await readTokens();

  if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
    lastCheckAt = now;
    lastStatus = { status: 'disconnected' };
    return NextResponse.json(lastStatus);
  }

  if (!tokens.refresh_token) {
    lastCheckAt = now;
    lastStatus = { status: 'disconnected' };
    return NextResponse.json(lastStatus);
  }

  if (!process.env.OLIST_CLIENT_ID || !process.env.OLIST_CLIENT_SECRET) {
    lastCheckAt = now;
    lastStatus = { status: 'unknown', reason: 'Credenciais não configuradas' };
    return NextResponse.json(lastStatus);
  }

  const newToken = await refreshAccessToken(tokens.refresh_token);
  if (newToken) {
    lastCheckAt = now;
    lastStatus = { status: 'connected' };
    return NextResponse.json(lastStatus);
  }

  lastCheckAt = now;
  lastStatus = { status: 'expired' };
  return NextResponse.json(lastStatus);
}
