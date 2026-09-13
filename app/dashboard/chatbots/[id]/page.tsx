import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserPlan } from '@/lib/plans';
import { redirect, notFound } from 'next/navigation';
import type { Chatbot } from '@/lib/types';
import { ChatbotDetail } from './detail';

export default async function ChatbotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) redirect('/');

  const { id } = await params;
  const db = createAdminClient();
  const { data: bot } = await db
    .from('chatbots')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!bot) notFound();

  const plan = await getUserPlan(user.id);

  return <ChatbotDetail chatbot={bot as Chatbot} plan={plan} />;
}
