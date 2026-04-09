import { NextResponse } from 'next/server';
import { resolveBasePath } from '@/lib/base-path';

function resolvePortalUrl(request: Request): string {
  const configured = process.env.APP_PORTAL_URL;
  if (configured) return configured.replace(/\/+$/, '');

  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  if (!host) return '';
  return `${proto}://${host}`.replace(/\/+$/, '');
}

export async function GET(request: Request) {
  const basePath = resolveBasePath();
  const portalUrl = resolvePortalUrl(request);
  const redirectTarget = portalUrl ? `${portalUrl}/` : '/';

  const response = NextResponse.redirect(redirectTarget, { status: 302 });
  response.cookies.set('auth_token', '', { maxAge: 0, path: basePath || '/' });
  return response;
}
