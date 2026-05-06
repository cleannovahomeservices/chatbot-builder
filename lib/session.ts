import { createAdminClient } from './supabase/admin';
import { cookies } from 'next/headers';
import crypto from 'crypto';

export const SESSION_COOKIE_NAME = 'chatbot_session';
const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;

export interface SessionUser {
  id: string;
  github_id: number;
  github_username: string;
  github_email: string | null;
  github_avatar_url: string | null;
  github_access_token: string;
}

export async function createSession(user: SessionUser): Promise<string> {
  const db = createAdminClient();
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DURATION_SECONDS * 1000);

  await db.from('sessions').insert({
    user_id: user.id,
    token,
    expires_at: expiresAt.toISOString(),
  });

  return token;
}

export async function getSession(tokenOverride?: string): Promise<SessionUser | null> {
  let token = tokenOverride;
  if (!token) {
    const cookieStore = await cookies();
    token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  }
  if (!token) return null;

  const db = createAdminClient();

  const { data: session } = await db
    .from('sessions')
    .select('user_id, expires_at')
    .eq('token', token)
    .single();

  if (!session || new Date(session.expires_at) < new Date()) return null;

  const { data: user } = await db
    .from('users')
    .select('*')
    .eq('id', session.user_id)
    .single();

  return user as SessionUser | null;
}

export async function deleteSession(token: string): Promise<void> {
  const db = createAdminClient();
  await db.from('sessions').delete().eq('token', token);
}

export { SESSION_DURATION_SECONDS };
