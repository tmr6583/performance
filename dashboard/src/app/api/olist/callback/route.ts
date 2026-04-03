import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { writeTokens } from '@/lib/olist-tokens';

const CLIENT_ID     = process.env.OLIST_CLIENT_ID;
const CLIENT_SECRET = process.env.OLIST_CLIENT_SECRET;
const TOKEN_URL = 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token';

function resolveBaseUrl(request: NextRequest): string {
  const configured = process.env.APP_BASE_URL;
  if (configured) return configured.replace(/\/+$/, '');

  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const origin = request.nextUrl.origin;
  return `${origin}${basePath}`.replace(/\/+$/, '');
}

export async function GET(request: NextRequest) {
  const baseUrl = resolveBaseUrl(request);

  const { searchParams } = request.nextUrl;
  const code        = searchParams.get('code');
  const error       = searchParams.get('error');
  const stateParam  = searchParams.get('state');
  const storedState = request.cookies.get('oauth_state')?.value;

  // Valida parâmetro state para prevenir CSRF
  if (!stateParam || !storedState || stateParam !== storedState) {
    return NextResponse.redirect(
      `${baseUrl}?olist_error=${encodeURIComponent('Estado OAuth inválido. Tente novamente.')}`,
      { status: 302 }
    );
  }

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

  const REDIRECT_URI = process.env.OLIST_REDIRECT_URI ?? 'https://betinalimpeza.ddns.net/performance/api/olist/callback';

  try {
    const body = new URLSearchParams({
      grant_type:    'authorization_code',
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      redirect_uri:  REDIRECT_URI,
      code,
    });

    const res = await fetch(TOKEN_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    });

    if (!res.ok) {
      return NextResponse.redirect(
        `${baseUrl}?olist_error=${encodeURIComponent('Falha ao trocar token. Tente novamente.')}`,
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

    await writeTokens({
      access_token:  tokens.access_token,
      refresh_token: tokens.refresh_token ?? null,
    });

    // Remove cookie de state após uso
    const response = NextResponse.redirect(`${baseUrl}/?olist_ok=1`, { status: 302 });
    response.cookies.set('oauth_state', '', { maxAge: 0, path: '/' });
    return response;
  } catch {
    return NextResponse.redirect(
      `${baseUrl}?olist_error=${encodeURIComponent('Erro inesperado. Tente novamente.')}`,
      { status: 302 }
    );
  }
}
