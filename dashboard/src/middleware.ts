import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ── Verificação JWT com Web Crypto (compatível com Edge runtime) ────────────

function b64urlToBytes(b64url: string): Uint8Array {
  // Base64url → Base64 com padding correto
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(b64.length + (4 - (b64.length % 4)) % 4, '=');
  const raw = atob(padded);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function verifyJwt(token: string, secret: string): Promise<boolean> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const [header, payload, sig] = parts;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      b64urlToBytes(sig).buffer as ArrayBuffer,
      encoder.encode(`${header}.${payload}`)
    );
    if (!valid) return false;

    // Verifica expiração
    const body = JSON.parse(new TextDecoder().decode(b64urlToBytes(payload)));
    return typeof body.exp === 'number' && body.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

// ── Middleware ──────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  const basePath = request.nextUrl.basePath ?? '';
  const { pathname } = request.nextUrl;

  // Assets estáticos — sem verificação
  if (
    pathname.startsWith('/_next/') ||
    pathname === '/favicon.ico' ||
    /\.(?:svg|png|jpg|jpeg|webp|ico)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  // Rotas públicas de autenticação e OAuth
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth') ||
    pathname === '/api/olist/callback'
  ) {
    return NextResponse.next();
  }

  // Requisições internas do scheduler — autenticadas por segredo compartilhado
  const internalSecret = process.env.INTERNAL_SECRET;
  if (
    internalSecret &&
    request.headers.get('x-internal-secret') === internalSecret
  ) {
    return NextResponse.next();
  }

  // Todas as demais rotas: exige JWT válido
  const token = request.cookies.get('auth_token')?.value;
  const jwtSecret = process.env.JWT_SECRET ?? '';

  if (!token || !(await verifyJwt(token, jwtSecret))) {
    return NextResponse.redirect(new URL(`${basePath}/login`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/:path*'],
};
