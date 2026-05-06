import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSession, SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from '@/lib/session';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const appUrl = new URL(request.url).origin;

  if (!code) return NextResponse.redirect(`${appUrl}/?error=auth_failed`);

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

  const {
    data: { session },
    error,
  } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !session?.user) {
    return NextResponse.redirect(`${appUrl}/?error=auth_failed`);
  }

  const supabaseUser = session.user;
  const googleId =
    supabaseUser.user_metadata?.sub ??
    supabaseUser.user_metadata?.provider_id ??
    supabaseUser.id;
  const googleEmail = supabaseUser.email ?? supabaseUser.user_metadata?.email ?? null;
  const googleName =
    supabaseUser.user_metadata?.full_name ?? supabaseUser.user_metadata?.name ?? null;
  const googleAvatar =
    supabaseUser.user_metadata?.avatar_url ?? supabaseUser.user_metadata?.picture ?? null;

  const db = createAdminClient();
  let user;

  const { data: byGoogleId } = await db
    .from('users')
    .select('*')
    .eq('google_id', googleId)
    .maybeSingle();

  if (byGoogleId) {
    const { data } = await db
      .from('users')
      .update({
        google_email: googleEmail,
        google_name: googleName,
        google_avatar_url: googleAvatar,
        updated_at: new Date().toISOString(),
      })
      .eq('id', byGoogleId.id)
      .select()
      .single();
    user = data;
  } else {
    const { data: byEmail } = googleEmail
      ? await db.from('users').select('*').eq('github_email', googleEmail).maybeSingle()
      : { data: null };

    if (byEmail) {
      const { data } = await db
        .from('users')
        .update({
          google_id: googleId,
          google_email: googleEmail,
          google_name: googleName,
          google_avatar_url: googleAvatar,
          updated_at: new Date().toISOString(),
        })
        .eq('id', byEmail.id)
        .select()
        .single();
      user = data;
    } else {
      const { data } = await db
        .from('users')
        .insert({
          google_id: googleId,
          google_email: googleEmail,
          google_name: googleName,
          google_avatar_url: googleAvatar,
        })
        .select()
        .single();
      user = data;
    }
  }

  if (!user) return NextResponse.redirect(`${appUrl}/?error=auth_failed`);

  const sessionToken = await createSession(user);
  const redirectTo =
    request.cookies.get('post_auth_redirect')?.value ?? `${appUrl}/dashboard`;

  const response = NextResponse.redirect(redirectTo);

  cookieJar.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options as Parameters<typeof response.cookies.set>[2]);
  });

  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_SECONDS,
    path: '/',
  });
  response.cookies.delete('post_auth_redirect');

  return response;
}
