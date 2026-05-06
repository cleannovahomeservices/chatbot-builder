import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChatbotCard } from './chatbot-card';

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
  if (!user) redirect('/login');

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
          <a
            href="/api/auth/github/revoke"
            className="text-xs text-white/30 hover:text-white/60 transition"
            title="Revocar y reconectar GitHub con permisos correctos"
          >
            Reconectar GitHub
          </a>
          {(user.github_avatar_url ?? user.google_avatar_url) && (
            <img
              src={user.github_avatar_url ?? user.google_avatar_url ?? undefined}
              alt={user.github_username ?? user.google_name ?? undefined}
              className="h-8 w-8 rounded-full border border-white/20"
            />
          )}
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
            <p className="text-white/50 mt-1">
              Hola, {user.github_username ?? user.google_name ?? user.email_address?.split("@")[0]}
            </p>
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
              <ChatbotCard key={bot.id} chatbot={bot} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
