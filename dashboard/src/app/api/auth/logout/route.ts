import { NextResponse } from 'next/server';

function resolvePortalUrl(request: Request): string {
  const configured = process.env.APP_PORTAL_URL;
  if (configured) return configured.replace(/\/+$/, '');

  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host = request.headers.get('x-forwarded-host') ?? request.headers.get('host') ?? '';
  return `${proto}://${host}`.replace(/\/+$/, '');
}

export async function GET(request: Request) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const portalUrl = resolvePortalUrl(request);

  const response = NextResponse.redirect(`${portalUrl}/`, { status: 302 });
  response.cookies.set('auth_token', '', { maxAge: 0, path: basePath || '/' });
  return response;
}
