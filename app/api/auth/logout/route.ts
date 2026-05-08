import { NextRequest, NextResponse } from 'next/server';
import { deleteSession, SESSION_COOKIE_NAME } from '@/lib/session';

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) await deleteSession(token);

  const response = NextResponse.redirect(new URL('/', request.url));
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    maxAge: 0,
    path: '/',
    domain: process.env.NODE_ENV === 'production' ? '.botluma.com' : undefined,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
  return response;
}
