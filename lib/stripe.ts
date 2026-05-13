import Stripe from 'stripe';
import type { PlanName } from './plans';

// Lazy init so the module can be imported at build time without STRIPE_SECRET_KEY
let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-04-22.dahlia',
    });
  }
  return _stripe;
}

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
