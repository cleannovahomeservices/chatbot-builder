import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';

interface Chatbot {
  id: string;
  name: string;
  github_repo: string;
  n8n_webhook_url: string;
  status: string;
  widget_injected: boolean;
  created_at: string;
}

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect('/api/auth/github');

  const db = createAdminClient();
  const { data: chatbots } = await db
    .from('chatbots')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white">
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <span className="font-bold text-lg">Chatbot Builder</span>
        <div className="flex items-center gap-4">
          <img
            src={user.github_avatar_url ?? undefined}
            alt={user.github_username}
            className="h-8 w-8 rounded-full border border-white/20"
          />
          <form action="/api/auth/logout" method="POST">
            <button className="text-sm text-white/50 hover:text-white transition cursor-pointer">
              Cerrar sesión
            </button>
          </form>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Mis chatbots</h1>
            <p className="text-white/50 mt-1">Hola, {user.github_username}</p>
          </div>
          <Link
            href="/"
            className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition"
          >
            + Nuevo chatbot
          </Link>
        </div>

        {!chatbots || chatbots.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center">
            <p className="text-white/40 mb-4">Todavía no tienes chatbots</p>
            <Link
              href="/"
              className="text-violet-400 hover:text-violet-300 text-sm transition"
            >
              Crea tu primer chatbot →
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {(chatbots as Chatbot[]).map((bot) => (
              <div
                key={bot.id}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="font-semibold text-lg truncate">{bot.name}</h2>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          bot.status === 'active'
                            ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'
                            : 'border-white/10 text-white/40'
                        }`}
                      >
                        {bot.status === 'active' ? 'Activo' : bot.status}
                      </span>
                      {bot.widget_injected && (
                        <span className="text-xs px-2 py-0.5 rounded-full border border-violet-500/30 text-violet-400 bg-violet-500/10">
                          Widget inyectado
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-white/40 mb-3">{bot.github_repo}</p>
                    <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
                      <span className="text-xs text-white/30 shrink-0">Webhook:</span>
                      <span className="text-xs font-mono text-violet-300 truncate">
                        {bot.n8n_webhook_url}
                      </span>
                    </div>
                  </div>
                  <div className="text-xs text-white/25 shrink-0">
                    {new Date(bot.created_at).toLocaleDateString('es-ES')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
