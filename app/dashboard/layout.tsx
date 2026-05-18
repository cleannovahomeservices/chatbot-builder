import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { DashboardShell } from './shell';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect('/login');

  return (
    <DashboardShell
      githubUsername={user.github_username}
      githubAvatar={user.github_avatar_url}
      googleName={user.google_name}
      googleAvatar={user.google_avatar_url}
      email={user.email_address}
      hasGithub={!!user.github_access_token}
    >
      {children}
    </DashboardShell>
  );
}
