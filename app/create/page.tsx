import { cookies } from 'next/headers';
import { CreateWizard } from './wizard';

export default async function CreatePage() {
  const cookieStore = await cookies();
  const raw = cookieStore.get('create_params')?.value;
  const params = raw ? (JSON.parse(raw) as { mode?: string; input?: string }) : {};

  return (
    <CreateWizard initialMode={params.mode ?? 'describe'} initialInput={params.input ?? ''} />
  );
}
