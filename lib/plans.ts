import { createAdminClient } from './supabase/admin';

export type PlanName = 'free' | 'starter' | 'pro' | 'unlimited';

export const PLAN_LIMITS: Record<PlanName, { chatbots: number; messages: number; extractions: number; monthly: boolean }> = {
  free:      { chatbots: 1,  messages: 20,  extractions: 2,  monthly: false },
  starter:   { chatbots: 3,  messages: 100, extractions: 5,  monthly: true  },
  pro:       { chatbots: 5,  messages: 500, extractions: 10, monthly: true  },
  unlimited: { chatbots: -1, messages: -1,  extractions: -1, monthly: true  },
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

function getCurrentMonthStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
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

// Atomic check + increment in a single DB operation — no race condition possible.
// Returns true if the message was allowed and counted, false if limit was reached.
export async function checkAndIncrementMessage(userId: string): Promise<boolean> {
  const plan = await getUserPlan(userId);
  const limit = PLAN_LIMITS[plan].messages;
  const period = getPeriodForPlan(plan);
  const db = createAdminClient();

  const { data } = await db.rpc('check_and_increment_message', {
    p_user_id: userId,
    p_period: period,
    p_limit: limit,
  });
  return data === true;
}

export async function getExtractionCount(userId: string, plan: PlanName): Promise<number> {
  const db = createAdminClient();
  let q = db
    .from('business_extractions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  // Plan free = total acumulado; planes de pago = mes en curso
  if (PLAN_LIMITS[plan].monthly) {
    q = q.gte('created_at', getCurrentMonthStart());
  }

  const { count } = await q;
  return count ?? 0;
}

export async function checkExtractionLimit(userId: string): Promise<{ allowed: boolean; count: number; limit: number; plan: PlanName }> {
  const plan = await getUserPlan(userId);
  const limit = PLAN_LIMITS[plan].extractions;
  if (limit === -1) {
    return { allowed: true, count: 0, limit, plan };
  }
  const count = await getExtractionCount(userId, plan);
  return { allowed: count < limit, count, limit, plan };
}

export async function getUserPlanData(userId: string) {
  const db = createAdminClient();
  const plan = await getUserPlan(userId);
  const limits = PLAN_LIMITS[plan];

  const [messageCount, chatbotCountResult, extractionCount] = await Promise.all([
    getMessageCount(userId, plan),
    db.from('chatbots').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    getExtractionCount(userId, plan),
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
    extractionCount,
    extractionLimit: limits.extractions,
    periodLabel,
    canCreateChatbot: limits.chatbots === -1 || chatbotCount < limits.chatbots,
    canSendMessage: limits.messages === -1 || messageCount < limits.messages,
    canExtract: limits.extractions === -1 || extractionCount < limits.extractions,
  };
}
