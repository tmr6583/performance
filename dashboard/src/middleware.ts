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

const MOUNT_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';
const MAX_PAYLOAD_MB = Number(process.env.APP_MAX_PAYLOAD_MB ?? '1');
const MAX_PAYLOAD_BYTES = Number.isFinite(MAX_PAYLOAD_MB) && MAX_PAYLOAD_MB > 0
  ? MAX_PAYLOAD_MB * 1024 * 1024
  : 1024 * 1024;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Next.js já lida com basePath internamente em muitos casos
  // O request.nextUrl.pathname geralmente já vem sem o basePath
  // Mas para garantir, vamos limpar se ele estiver lá
  const effectivePath = MOUNT_PATH && pathname.startsWith(MOUNT_PATH)
    ? pathname.slice(MOUNT_PATH.length) || '/'
    : pathname;

  // Assets estáticos — sem verificação
  if (
    effectivePath.startsWith('/_next/') ||
    effectivePath === '/favicon.ico' ||
    /\.(?:svg|png|jpg|jpeg|webp|ico)$/i.test(effectivePath)
  ) {
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return response;
  }

  if (
    effectivePath.startsWith('/api/') &&
    ['POST', 'PUT', 'PATCH'].includes(request.method)
  ) {
    const contentLength = Number(request.headers.get('content-length') ?? '0');
    if (Number.isFinite(contentLength) && contentLength > MAX_PAYLOAD_BYTES) {
      return NextResponse.json({ error: 'Payload muito grande' }, { status: 413 });
    }
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
    const loginUrl = new URL(`${MOUNT_PATH}/login`, request.url);
    // Remove o base path duplicado se a URL base já contiver ele
    if (loginUrl.pathname.startsWith(MOUNT_PATH + MOUNT_PATH)) {
      loginUrl.pathname = loginUrl.pathname.replace(MOUNT_PATH + MOUNT_PATH, MOUNT_PATH);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/:path*'],
};
