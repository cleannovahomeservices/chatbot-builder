import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { LoginForm } from './form';

interface Props {
  searchParams: Promise<{ mode?: string; input?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const [user, sp] = await Promise.all([getSession(), searchParams]);

  if (user) redirect('/dashboard');

  return <LoginForm mode={sp.mode} input={sp.input} />;
}
