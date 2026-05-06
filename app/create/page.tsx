import { cookies } from 'next/headers';
import { CreateWizard } from './wizard';

interface Props {
  searchParams: Promise<{ vercel?: string; mode?: string; input?: string }>;
}

export default async function CreatePage({ searchParams }: Props) {
  const cookieStore = await cookies();
  const raw = cookieStore.get('create_params')?.value;
  const cookieParams = raw ? (JSON.parse(raw) as { mode?: string; input?: string }) : {};
  const sp = await searchParams;

  // Cookie takes priority (set during OAuth flow), fallback to URL params
  const mode = cookieParams.mode ?? sp.mode ?? 'describe';
  const input = cookieParams.input ?? sp.input ?? '';

  return (
    <CreateWizard
      initialMode={mode}
      initialInput={input}
      initialVercel={sp.vercel === '1'}
    />
  );
}
