import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import path from 'path';
import fs from 'fs';

const TOKEN_FILE    = path.join(process.cwd(), '..', '.tiny_tokens.json');
const CLIENT_ID     = process.env.OLIST_CLIENT_ID;
const CLIENT_SECRET = process.env.OLIST_CLIENT_SECRET;
const TOKEN_URL     = 'https://accounts.tiny.com.br/realms/tiny/protocol/openid-connect/token';

export async function GET() {
  const user = await getAuthUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 403 });
  }

  if (!fs.existsSync(TOKEN_FILE)) {
    return NextResponse.json({ status: 'disconnected' });
  }

  let tokens: { access_token?: string; refresh_token?: string } = {};
  try {
    tokens = JSON.parse(fs.readFileSync(TOKEN_FILE, 'utf-8'));
  } catch {
    return NextResponse.json({ status: 'disconnected' });
  }

  if (!tokens.refresh_token) {
    return NextResponse.json({ status: 'disconnected' });
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.json({ status: 'unknown', reason: 'Credenciais não configuradas' });
  }

  try {
    const body = new URLSearchParams({
      grant_type:    'refresh_token',
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: tokens.refresh_token,
    });

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) return NextResponse.json({ status: 'expired' });

    const newTokens = await res.json() as { access_token?: string; refresh_token?: string };
    if (newTokens.access_token) {
      fs.writeFileSync(TOKEN_FILE, JSON.stringify({
        access_token:  newTokens.access_token,
        refresh_token: newTokens.refresh_token ?? tokens.refresh_token,
      }));
      return NextResponse.json({ status: 'connected' });
    }

    return NextResponse.json({ status: 'expired' });
  } catch {
    return NextResponse.json({ status: 'unknown', reason: 'Erro ao verificar conexão' });
  }
}
