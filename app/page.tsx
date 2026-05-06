import { getSession } from '@/lib/session';
import { LandingPage } from './landing';

export default async function Home() {
  const user = await getSession();
  return (
    <LandingPage
      isLoggedIn={!!user}
      username={user?.github_username ?? user?.google_name ?? null}
    />
  );
}
