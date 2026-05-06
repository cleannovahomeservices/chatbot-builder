import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import { createSession, SESSION_COOKIE_NAME, SESSION_DURATION_SECONDS } from '@/lib/session';

export async function POST(request: NextRequest) {
  const { action, email, password } = await request.json();

  if (!email?.trim() || !password?.trim()) {
    return NextResponse.json({ error: 'Email y contraseña requeridos' }, { status: 400 });
  }

  // Use service role for admin auth operations so we can auto-confirm emails
  const adminAuth = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  let authUser;

  if (action === 'signup') {
    // Create user with email pre-confirmed — no confirmation email needed
    const { data, error } = await adminAuth.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) {
      const msg =
        error.message.includes('already been registered') || error.message.includes('already exists')
          ? 'Ya existe una cuenta con ese email. Inicia sesión.'
          : error.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    authUser = data.user;
  } else {
    // Sign in
    const anonClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data, error } = await anonClient.auth.signInWithPassword({ email, password });
    if (error) {
      const msg =
        error.message === 'Invalid login credentials'
          ? 'Email o contraseña incorrectos'
          : error.message === 'Email not confirmed'
          ? 'Confirma tu email antes de iniciar sesión'
          : error.message;
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    authUser = data.user;
  }

  if (!authUser) {
    return NextResponse.json({ error: 'Error de autenticación' }, { status: 400 });
  }

  const emailId = `email:${authUser.id}`;
  const db = createAdminClient();
  let user;

  const { data: existing } = await db
    .from('users')
    .select('*')
    .eq('google_id', emailId)
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
        .update({ google_id: emailId, updated_at: new Date().toISOString() })
        .eq('id', linked.id)
        .select()
        .single();
      user = data;
    } else {
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
