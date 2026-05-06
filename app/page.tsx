import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';

export default async function Home() {
  const user = await getSession();
  if (user) redirect('/dashboard');
  redirect('/login');
}
