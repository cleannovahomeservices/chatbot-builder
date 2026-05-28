import { getSession } from '@/lib/session';
import { redirect } from 'next/navigation';
import { getUserPlanData, PLAN_LABELS, PLAN_PRICES } from '@/lib/plans';
import { SettingsForm } from './settings-form';
import { GithubSection } from './github-section';
import { Suspense } from 'react';

export default async function SettingsPage() {
  const user = await getSession();
  if (!user) redirect('/login');

  const planData = await getUserPlanData(user.id);

  const displayName = user.display_name ?? user.github_username ?? user.google_name ?? '';
  const email = user.email_address ?? user.github_email ?? user.google_email ?? '—';

  const authMethod = user.github_id
    ? 'GitHub'
    : user.google_id
      ? 'Google'
      : user.email_user_id
        ? 'Email'
        : 'Desconocido';

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <h1 className="text-2xl sm:text-3xl font-bold mb-1">Ajustes</h1>
      <p className="text-white/50 mb-8">Configura tu cuenta y preferencias</p>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Perfil</h2>
        <SettingsForm initialName={displayName} email={email} />
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Cuenta</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <dt className="text-white/50">Email</dt>
            <dd className="text-white">{email}</dd>
          </div>
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <dt className="text-white/50">Método de acceso</dt>
            <dd className="text-white">{authMethod}</dd>
          </div>
          <Suspense fallback={null}>
            <GithubSection
              connected={!!user.github_access_token}
              username={user.github_username ?? null}
            />
          </Suspense>
        </dl>
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="text-lg font-semibold mb-4">Plan</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-medium">{PLAN_LABELS[planData.plan]}</p>
            <p className="text-xs text-white/40 mt-0.5">
              {planData.plan === 'free' ? 'Plan gratuito' : PLAN_PRICES[planData.plan]}
            </p>
          </div>
          <a
            href="/dashboard"
            className="text-xs text-violet-400 hover:text-violet-300 transition"
          >
            Gestionar plan →
          </a>
        </div>
      </section>
    </div>
  );
}
