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

  if (authError) {
    const msg =
      authError.message === 'Invalid login credentials'
        ? 'Email o contraseña incorrectos'
        : authError.message === 'User already registered'
        ? 'Ya existe una cuenta con ese email. Inicia sesión.'
        : authError.message;
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (!authData?.user) {
    return NextResponse.json({ error: 'Error de autenticación' }, { status: 400 });
  }

  // signUp with email confirmation enabled returns user but no session
  // We treat these users as authenticated immediately
  const authUser = authData.user;
  const emailId = `email:${authUser.id}`;

  const db = createAdminClient();
  let user;

  // Find existing user by email auth ID
  const { data: existing } = await db
    .from('users')
    .select('*')
    .eq('google_id', emailId)
    .maybeSingle();

  if (existing) {
    user = existing;
  } else {
    // Check if a GitHub or Google user has the same email — link accounts
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
      // Link email auth to existing account
      const { data } = await db
        .from('users')
        .update({ google_id: emailId, updated_at: new Date().toISOString() })
        .eq('id', linked.id)
        .select()
        .single();
      user = data;
    } else {
      // New email-only user — store using existing columns
      const { data, error: insertError } = await db
        .from('users')
        .insert({
          google_id: emailId,
          google_email: email,
          google_name: email.split('@')[0],
        })
        .select()
        .single();
      if (insertError) {
        console.error('Email user insert error:', insertError.message);
        return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
      }
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
