import Stripe from 'stripe';
import type { PlanName } from './plans';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-04-22.dahlia',
});

export const STRIPE_PRICES: Record<Exclude<PlanName, 'free'>, string> = {
  starter:   process.env.STRIPE_PRICE_STARTER!,
  pro:       process.env.STRIPE_PRICE_PRO!,
  unlimited: process.env.STRIPE_PRICE_UNLIMITED!,
};

export function getPlanFromPriceId(priceId: string): PlanName | null {
  for (const [plan, id] of Object.entries(STRIPE_PRICES)) {
    if (id === priceId) return plan as PlanName;
  }
  return null;
}
