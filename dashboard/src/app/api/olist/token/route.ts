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
    auto_refresh_hours: 12,
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

  if (action === 'save') {
    await saveOlistCredentials({
      redirect_uri: typeof body.redirect_uri === 'string' ? body.redirect_uri : undefined,
      client_id: typeof body.client_id === 'string' ? body.client_id : undefined,
      client_secret: typeof body.client_secret === 'string' ? body.client_secret : undefined,
    });
    return NextResponse.json({ success: true });
  }

  if (action === 'refresh') {
    const accessToken = await refreshAccessTokenFromStoredConfig();
    return NextResponse.json({ success: !!accessToken, access_token_set: !!accessToken });
  }

  return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
}
