import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
  const url = new URL(request.url);
  const loginUrl = `${url.protocol}//${url.host}${basePath}/login`;

  const response = NextResponse.redirect(loginUrl, { status: 302 });
  response.cookies.set('auth_token', '', { maxAge: 0, path: '/' });
  return response;
}
