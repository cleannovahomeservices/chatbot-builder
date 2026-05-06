import { cookies } from 'next/headers';
import { CreateWizard } from './wizard';

interface Props {
  searchParams: Promise<{ vercel?: string }>;
}

export default async function CreatePage({ searchParams }: Props) {
  const cookieStore = await cookies();
  const raw = cookieStore.get('create_params')?.value;
  const params = raw ? (JSON.parse(raw) as { mode?: string; input?: string }) : {};
  const sp = await searchParams;

  return (
    <CreateWizard
      initialMode={params.mode ?? 'describe'}
      initialInput={params.input ?? ''}
      initialVercel={sp.vercel === '1'}
    />
  );
}
