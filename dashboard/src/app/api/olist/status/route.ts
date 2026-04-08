import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { getOlistCredentialsRaw, readTokens, refreshAccessTokenFromStoredConfig } from '@/lib/olist-tokens';

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
  const creds = getOlistCredentialsRaw();
  const hasRefreshToken = !!(tokens?.refresh_token || creds.refresh_token);

  if (!tokens && !hasRefreshToken) {
    lastCheckAt = now;
    lastStatus = { status: 'disconnected' };
    return NextResponse.json(lastStatus);
  }

  if (!hasRefreshToken) {
    lastCheckAt = now;
    lastStatus = { status: 'disconnected' };
    return NextResponse.json(lastStatus);
  }

  const newToken = await refreshAccessTokenFromStoredConfig();
  if (newToken) {
    lastCheckAt = now;
    lastStatus = { status: 'connected' };
    return NextResponse.json(lastStatus);
  }

  lastCheckAt = now;
  lastStatus = { status: 'expired' };
  return NextResponse.json(lastStatus);
}
