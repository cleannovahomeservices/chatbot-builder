'use client';

import { useState } from 'react';
import type { PlanName } from '@/lib/plans';

const PLANS: Array<{
  id: Exclude<PlanName, 'free'>;
  name: string;
  price: string;
  chatbots: string;
  messages: string;
  highlight?: boolean;
}> = [
  { id: 'starter',   name: 'Starter',   price: '5€/mes',  chatbots: '3 chatbots',      messages: '100 mensajes/mes' },
  { id: 'pro',       name: 'Pro',        price: '10€/mes', chatbots: '5 chatbots',      messages: '500 mensajes/mes', highlight: true },
  { id: 'unlimited', name: 'Unlimited',  price: '20€/mes', chatbots: '∞ chatbots',      messages: '∞ mensajes' },
];

interface Props {
  currentPlan: PlanName;
  onClose: () => void;
}

export function PricingModal({ currentPlan, onClose }: Props) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleChoose(plan: Exclude<PlanName, 'free'>) {
    setLoading(plan);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      setLoading(null);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-3xl rounded-2xl border border-white/10 bg-[#111] p-6 sm:p-8">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/40 hover:text-white text-xl leading-none"
        >
          ✕
        </button>

        <h2 className="text-2xl font-bold mb-1">Elige tu plan</h2>
        <p className="text-white/50 text-sm mb-6">Cancela cuando quieras desde el panel de cliente.</p>

        <div className="grid sm:grid-cols-3 gap-4">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan === plan.id;
            return (
              <div
                key={plan.id}
                className={`relative rounded-xl border p-5 flex flex-col gap-4 ${
                  plan.highlight
                    ? 'border-violet-500 bg-violet-500/10'
                    : 'border-white/10 bg-white/[0.03]'
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-3 py-0.5 text-xs font-semibold text-white whitespace-nowrap">
                    Más popular
                  </span>
                )}
                <div>
                  <p className="font-semibold text-lg">{plan.name}</p>
                  <p className="text-2xl font-bold mt-1">{plan.price}</p>
                </div>
                <ul className="text-sm text-white/60 space-y-1 flex-1">
                  <li>✓ {plan.chatbots}</li>
                  <li>✓ {plan.messages}</li>
                  <li>✓ Widget personalizable</li>
                  <li>✓ IA incluida</li>
                </ul>
                {isCurrent ? (
                  <span className="block text-center text-xs text-white/40 py-2 border border-white/10 rounded-lg">
                    Plan actual
                  </span>
                ) : (
                  <button
                    onClick={() => handleChoose(plan.id)}
                    disabled={loading !== null}
                    className={`rounded-lg py-2.5 text-sm font-semibold transition disabled:opacity-50 ${
                      plan.highlight
                        ? 'bg-violet-600 hover:bg-violet-500 text-white'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    {loading === plan.id ? 'Redirigiendo…' : 'Elegir plan'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
