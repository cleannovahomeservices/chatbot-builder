import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserPlanData } from '@/lib/plans';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChatbotCard } from './chatbot-card';
import { HelpWidget } from './help-widget';
import { PlanBanner, NewChatbotButton } from './plan-banner';

interface Chatbot {
  id: string;
  name: string;
  github_repo: string;
  n8n_webhook_url: string;
  status: string;
  widget_injected: boolean;
  created_at: string;
  updated_at: string;
}

export default async function DashboardPage() {
  const user = await getSession();
  if (!user) redirect('/login');

  const db = createAdminClient();
  const [{ data: chatbots }, planData] = await Promise.all([
    db.from('chatbots').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    getUserPlanData(user.id),
  ]);

  const displayName = user.github_username ?? user.google_name ?? user.email_address?.split('@')[0];

  return (
    <>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
            <p className="text-white/50 mt-1">Hola, {displayName}</p>
          </div>
          <NewChatbotButton canCreate={planData.canCreateChatbot} plan={planData.plan} />
        </div>

        <PlanBanner data={planData} />

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
      <HelpWidget />
    </>
  );
}
