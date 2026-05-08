import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('mode');
  const input = searchParams.get('input');
  const appUrl = new URL(request.url).origin;

  const cookieJar: { name: string; value: string; options: Record<string, unknown> }[] = [];

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach((c) => cookieJar.push(c));
        },
      },
    }
  );

  const callbackBase = process.env.APP_BASE_URL || appUrl;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${callbackBase}/api/auth/supabase/callback`,
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`);
  }

  const response = NextResponse.redirect(data.url);
  const cookieDomain = process.env.NODE_ENV === 'production' ? '.botluma.com' : undefined;

  cookieJar.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
  });

  const redirectTarget =
    mode && input
      ? `${appUrl}/create?mode=${mode}&input=${encodeURIComponent(input)}`
      : `${appUrl}/dashboard`;

  response.cookies.set('post_auth_redirect', redirectTarget, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600,
    path: '/',
    domain: cookieDomain,
  });

  return response;
}
