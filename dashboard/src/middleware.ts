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

    // Verifica expiração e role
    const body = JSON.parse(new TextDecoder().decode(b64urlToBytes(payload)));
    return (
      typeof body.exp === 'number' &&
      body.exp > Date.now() / 1000 &&
      body.role === 'admin'
    );
  } catch {
    return false;
  }
}

// ── Middleware ──────────────────────────────────────────────────────────────

const MOUNT_PATH = '/performance';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const effectivePath = pathname.startsWith(MOUNT_PATH)
    ? pathname.slice(MOUNT_PATH.length) || '/'
    : pathname;

  // Assets estáticos — sem verificação
  if (
    effectivePath.startsWith('/_next/') ||
    effectivePath === '/favicon.ico' ||
    /\.(?:svg|png|jpg|jpeg|webp|ico)$/i.test(effectivePath)
  ) {
    return NextResponse.next();
  }

  // Rotas públicas de autenticação e OAuth
  if (
    effectivePath === '/login' ||
    effectivePath.startsWith('/api/auth') ||
    effectivePath === '/api/olist/callback'
  ) {
    return NextResponse.next();
  }

  // Requisições internas do scheduler — autenticadas por segredo compartilhado
  const internalSecret = process.env.INTERNAL_SECRET;
  if (
    internalSecret &&
    effectivePath === '/api/scripts' &&
    request.headers.get('x-internal-secret') === internalSecret
  ) {
    return NextResponse.next();
  }

  // Todas as demais rotas: exige JWT válido
  const token = request.cookies.get('auth_token')?.value;
  const jwtSecret = process.env.JWT_SECRET ?? '';

  if (!token || !(await verifyJwt(token, jwtSecret))) {
    return NextResponse.redirect(new URL(`${MOUNT_PATH}/login`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/:path*'],
};
