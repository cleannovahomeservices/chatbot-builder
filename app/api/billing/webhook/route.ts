import { NextRequest, NextResponse } from 'next/server';
import { getStripe, getPlanFromPriceId } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';
import type Stripe from 'stripe';

export const config = { api: { bodyParser: false } };

// Stripe API 2026-04-22.dahlia moved current_period_end from Subscription to SubscriptionItem.
// Fall back to the legacy top-level field for safety across versions.
function getPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const item = subscription.items?.data?.[0] as unknown as { current_period_end?: number } | undefined;
  const legacy = (subscription as unknown as { current_period_end?: number }).current_period_end;
  const ts = item?.current_period_end ?? legacy;
  if (!ts || !Number.isFinite(ts)) return null;
  const d = new Date(ts * 1000);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function upsertSubscription(
  db: ReturnType<typeof createAdminClient>,
  userId: string,
  plan: string,
  customerId: string,
  subscriptionId: string | null,
  priceId: string | null,
  status: string,
  periodEnd: Date | null,
) {
  await Promise.all([
    db.from('users').update({ plan, plan_expires_at: periodEnd?.toISOString() ?? null }).eq('id', userId),
    db.from('subscriptions').upsert(
      {
        user_id: userId,
        stripe_customer_id: customerId,
        stripe_subscription_id: subscriptionId,
        stripe_price_id: priceId,
        plan,
        status,
        current_period_end: periodEnd?.toISOString() ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    ),
  ]);
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature');
  if (!sig) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const db = createAdminClient();

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== 'subscription') break;
      const userId = session.metadata?.user_id;
      const plan = session.metadata?.plan;
      if (!userId || !plan) break;

      const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
      const priceId = subscription.items.data[0]?.price.id ?? null;
      const periodEnd = getPeriodEnd(subscription);

      await upsertSubscription(db, userId, plan, session.customer as string, subscription.id, priceId, 'active', periodEnd);
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.user_id;
      if (!userId) break;

      const priceId = subscription.items.data[0]?.price.id ?? null;
      const plan = priceId ? getPlanFromPriceId(priceId) : null;
      if (!plan) break;

      const periodEnd = getPeriodEnd(subscription);
      await upsertSubscription(db, userId, plan, subscription.customer as string, subscription.id, priceId, subscription.status, periodEnd);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const userId = subscription.metadata?.user_id;
      if (!userId) break;

      await upsertSubscription(db, userId, 'free', subscription.customer as string, subscription.id, null, 'canceled', null);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      await db.from('subscriptions').update({ status: 'past_due' }).eq('stripe_customer_id', customerId);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
