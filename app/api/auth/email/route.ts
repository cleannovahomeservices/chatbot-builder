import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSession, SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from '@/lib/session';

export async function POST(request: NextRequest) {
  const { action, email, password } = await request.json();

  if (!email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const authResult =
    action === 'signup'
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });

  const { data: authData, error: authError } = authResult;

  if (authError || !authData?.user) {
    return NextResponse.json(
      { error: authError?.message ?? 'Error de autenticación' },
      { status: 400 }
    );
  }

  const authUser = authData.user;
  const db = createAdminClient();
  let user;

  const { data: existing } = await db
    .from('users')
    .select('*')
    .eq('email_user_id', authUser.id)
    .maybeSingle();

  if (existing) {
    user = existing;
  } else {
    const { data: byGithubEmail } = await db
      .from('users')
      .select('*')
      .eq('github_email', email)
      .maybeSingle();
    const { data: byGoogleEmail } = await db
      .from('users')
      .select('*')
      .eq('google_email', email)
      .maybeSingle();

    const linked = byGithubEmail ?? byGoogleEmail;
    if (linked) {
      const { data } = await db
        .from('users')
        .update({
          email_user_id: authUser.id,
          email_address: email,
          updated_at: new Date().toISOString(),
        })
        .eq('id', linked.id)
        .select()
        .single();
      user = data;
    } else {
      const { data } = await db
        .from('users')
        .insert({ email_user_id: authUser.id, email_address: email })
        .select()
        .single();
      user = data;
    }
  }

  if (!user) {
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
  }

  const sessionToken = await createSession(user);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_DURATION_SECONDS,
    path: '/',
  });

  return response;
}
