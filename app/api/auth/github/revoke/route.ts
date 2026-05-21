import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: NextRequest) {
  const user = await getSession();
  const appUrl = new URL(request.url).origin;

  if (!user) return NextResponse.redirect(`${appUrl}/login`);

  const token = user.github_access_token;

  // Delete the OAuth grant on GitHub so the next auth shows a fresh consent screen
  if (token) {
    try {
      await fetch(
        `https://api.github.com/applications/${process.env.GITHUB_CLIENT_ID}/grant`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Basic ${Buffer.from(`${process.env.GITHUB_CLIENT_ID}:${process.env.GITHUB_CLIENT_SECRET}`).toString('base64')}`,
            Accept: 'application/vnd.github+json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ access_token: token }),
        }
      );
      console.log('[revoke] GitHub grant deleted for user', user.id);
    } catch (e) {
      console.error('[revoke] failed to delete GitHub grant:', e);
    }
  }

  // Clear the token from DB so our app also forgets it
  const db = createAdminClient();
  await db.from('users').update({
    github_access_token: null,
    github_id: null,
    github_username: null,
    github_email: null,
    github_avatar_url: null,
  }).eq('id', user.id);

  // Redirect back to settings with a flag so the UI can guide the user
  // (GitHub has no `prompt=select_account`, so the user must log out of github.com
  // manually before connecting a different account)
  return NextResponse.redirect(`${appUrl}/dashboard/settings?disconnected=github`);
}
