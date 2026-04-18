import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import {
  getOlistCredentialsSummary,
  getTokenRefreshLogs,
  readTokens,
  refreshAccessTokenFromStoredConfig,
  saveOlistCredentials,
} from '@/lib/olist-tokens';

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  const creds = getOlistCredentialsSummary();
  const tokens = await readTokens();
  const logs = getTokenRefreshLogs(120);

  return NextResponse.json({
    credentials: creds,
    token_file: {
      access_token_set: !!tokens?.access_token,
      refresh_token_set: !!tokens?.refresh_token,
    },
    auto_refresh: {
      boot: true,
      daily_times: ['07:00', '15:00', '23:00'],
    },
    logs,
  });
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  const body = (await request.json()) as {
    action?: unknown;
    redirect_uri?: unknown;
    client_id?: unknown;
    client_secret?: unknown;
  };

  const action = typeof body.action === 'string' ? body.action : '';
  const normalizeOptionalField = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  };

  if (action === 'save') {
    await saveOlistCredentials({
      redirect_uri: normalizeOptionalField(body.redirect_uri),
      client_id: normalizeOptionalField(body.client_id),
      client_secret: normalizeOptionalField(body.client_secret),
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'refresh') {
    const accessToken = await refreshAccessTokenFromStoredConfig();
    return NextResponse.json({ success: !!accessToken, access_token_set: !!accessToken });
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
}
