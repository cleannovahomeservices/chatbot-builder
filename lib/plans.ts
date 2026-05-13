import { createAdminClient } from './supabase/admin';

export type PlanName = 'free' | 'starter' | 'pro' | 'unlimited';

export const PLAN_LIMITS: Record<PlanName, { chatbots: number; messages: number; monthly: boolean }> = {
  free:      { chatbots: 1,  messages: 20,  monthly: false },
  starter:   { chatbots: 3,  messages: 100, monthly: true  },
  pro:       { chatbots: 5,  messages: 500, monthly: true  },
  unlimited: { chatbots: -1, messages: -1,  monthly: true  },
};

export const PLAN_LABELS: Record<PlanName, string> = {
  free:      'Gratuito',
  starter:   'Starter',
  pro:       'Pro',
  unlimited: 'Unlimited',
};

export const PLAN_PRICES: Record<Exclude<PlanName, 'free'>, string> = {
  starter:   '5€/mes',
  pro:       '10€/mes',
  unlimited: '20€/mes',
};

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getPeriodForPlan(plan: PlanName): string {
  return PLAN_LIMITS[plan].monthly ? getCurrentPeriod() : 'free';
}

export async function getUserPlan(userId: string): Promise<PlanName> {
  const db = createAdminClient();
  const { data } = await db
    .from('users')
    .select('plan, plan_expires_at')
    .eq('id', userId)
    .single();
  if (!data) return 'free';

  // If plan has expired, treat as free
  if (data.plan_expires_at && new Date(data.plan_expires_at) < new Date()) {
    return 'free';
  }
  return (data.plan as PlanName) || 'free';
}

export async function getMessageCount(userId: string, plan: PlanName): Promise<number> {
  const db = createAdminClient();
  const period = getPeriodForPlan(plan);
  const { data } = await db
    .from('message_usage')
    .select('count')
    .eq('user_id', userId)
    .eq('period', period)
    .maybeSingle();
  return data?.count ?? 0;
}

export async function checkChatbotLimit(userId: string): Promise<boolean> {
  const plan = await getUserPlan(userId);
  const limit = PLAN_LIMITS[plan].chatbots;
  if (limit === -1) return true;

  const db = createAdminClient();
  const { count } = await db
    .from('chatbots')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  return (count ?? 0) < limit;
}

export async function checkMessageLimit(userId: string): Promise<boolean> {
  const plan = await getUserPlan(userId);
  const limit = PLAN_LIMITS[plan].messages;
  if (limit === -1) return true;

  const used = await getMessageCount(userId, plan);
  return used < limit;
}

export async function incrementMessageCount(userId: string): Promise<void> {
  const plan = await getUserPlan(userId);
  const period = getPeriodForPlan(plan);
  const db = createAdminClient();

  await db.rpc('increment_message_count', { p_user_id: userId, p_period: period });
}

export async function getUserPlanData(userId: string) {
  const db = createAdminClient();
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];

  const [messageCount, chatbotCountResult] = await Promise.all([
    getMessageCount(userId, plan),
    db.from('chatbots').select('id', { count: 'exact', head: true }).eq('user_id', userId),
  ]);

  const chatbotCount = chatbotCountResult.count ?? 0;
  const period = getPeriodForPlan(plan);
  const periodLabel = limits.monthly ? `Mensual (${period})` : 'Total acumulado';

  return {
    plan,
    planLabel: PLAN_LABELS[plan],
    chatbotCount,
    chatbotLimit: limits.chatbots,
    messageCount,
    messageLimit: limits.messages,
    periodLabel,
    canCreateChatbot: limits.chatbots === -1 || chatbotCount < limits.chatbots,
    canSendMessage: limits.messages === -1 || messageCount < limits.messages,
  };
}
