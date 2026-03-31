import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const basePath = request.nextUrl.basePath ?? '';
  const token = request.cookies.get('auth_token')?.value;
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/_next/') || pathname === '/favicon.ico') {
    return NextResponse.next();
  }

  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth') ||
    pathname === '/api/olist/callback' ||
    /\.(?:svg|png|jpg|jpeg|webp|ico)$/i.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL(`${basePath}/login`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/:path*'],
};
