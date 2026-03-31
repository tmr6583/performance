import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import path from 'path';
import fs from 'fs';

const CLIENT_ID     = process.env.OLIST_CLIENT_ID;
const CLIENT_SECRET = process.env.OLIST_CLIENT_SECRET;
const REDIRECT_URI  = process.env.OLIST_REDIRECT_URI
  ?? 'https://betinalimpeza.ddns.net/performance/api/olist/callback';
const TOKEN_URL     = 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token';
const TOKEN_FILE    = path.join(process.cwd(), '..', '.tiny_tokens.json');

export async function GET(request: NextRequest) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const proto    = request.headers.get('x-forwarded-proto') ?? 'https';
  const host     = request.headers.get('host') ?? 'betinalimpeza.ddns.net';
  const baseUrl  = `${proto}://${host}${basePath}`;

  const { searchParams } = request.nextUrl;
  const code  = searchParams.get('code');
  const error = searchParams.get('error');

  if (error || !code) {
    const msg = error ?? 'Código de autorização não recebido';
    return NextResponse.redirect(`${baseUrl}?olist_error=${encodeURIComponent(msg)}`, { status: 302 });
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.redirect(
      `${baseUrl}?olist_error=${encodeURIComponent('Credenciais Olist não configuradas')}`,
      { status: 302 }
    );
  }

  try {
    const body = new URLSearchParams({
      grant_type:    'authorization_code',
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      code,
    });

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.redirect(
        `${baseUrl}?olist_error=${encodeURIComponent(`Erro ao trocar token: ${text}`)}`,
        { status: 302 }
      );
    }

    const tokens = await res.json() as { access_token?: string; refresh_token?: string };
    if (!tokens.access_token) {
      return NextResponse.redirect(
        `${baseUrl}?olist_error=${encodeURIComponent('Resposta inválida do servidor Olist')}`,
        { status: 302 }
      );
    }

    fs.writeFileSync(TOKEN_FILE, JSON.stringify({
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
    }));

    return NextResponse.redirect(`${baseUrl}/admin?olist_ok=1`, { status: 302 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Erro inesperado';
    return NextResponse.redirect(
      `${baseUrl}?olist_error=${encodeURIComponent(msg)}`,
      { status: 302 }
    );
  }
}
