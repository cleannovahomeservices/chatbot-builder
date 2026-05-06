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
            href="/api/auth/github?next=/dashboard&force=true"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white/50 hover:border-white/30 hover:text-white transition"
            title="Reconectar GitHub para actualizar permisos de escritura"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/>
            </svg>
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
