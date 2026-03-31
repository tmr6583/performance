import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

const CLIENT_ID   = process.env.OLIST_CLIENT_ID;
const REDIRECT_URI = process.env.OLIST_REDIRECT_URI
  ?? 'https://betinalimpeza.ddns.net/performance/api/olist/callback';
const AUTH_URL = 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/auth';

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  if (!CLIENT_ID) {
    return NextResponse.json({ error: 'OLIST_CLIENT_ID não configurado' }, { status: 500 });
  }

  const params = new URLSearchParams({
    client_id:     CLIENT_ID,
    redirect_uri:  REDIRECT_URI,
    scope:         'openid',
    response_type: 'code',
  });

  return NextResponse.redirect(`${AUTH_URL}?${params.toString()}`, { status: 302 });
}
