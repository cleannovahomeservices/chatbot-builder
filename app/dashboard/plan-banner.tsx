'use client';

import { useState } from 'react';
import type { PlanName } from '@/lib/plans';

interface PlanData {
  plan: PlanName;
  planLabel: string;
  chatbotCount: number;
  chatbotLimit: number;
  messageCount: number;
  messageLimit: number;
  periodLabel: string;
  canCreateChatbot: boolean;
  canSendMessage: boolean;
}

const PLAN_CARDS = [
  {
    id: 'free' as PlanName,
    name: 'Gratuito',
    price: '0€',
    per: '',
    chatbots: '1 chatbot',
    messages: '20 mensajes',
    note: 'total (trial)',
    color: 'border-white/10',
    badge: '',
  },
  {
    id: 'starter' as PlanName,
    name: 'Starter',
    price: '5€',
    per: '/mes',
    chatbots: '3 chatbots',
    messages: '100 mensajes',
    note: 'al mes',
    color: 'border-white/10',
    badge: '',
  },
  {
    id: 'pro' as PlanName,
    name: 'Pro',
    price: '10€',
    per: '/mes',
    chatbots: '5 chatbots',
    messages: '500 mensajes',
    note: 'al mes',
    color: 'border-violet-500',
    badge: 'Más popular',
  },
  {
    id: 'unlimited' as PlanName,
    name: 'Unlimited',
    price: '20€',
    per: '/mes',
    chatbots: '∞ chatbots',
    messages: '∞ mensajes',
    note: '',
    color: 'border-white/10',
    badge: '',
  },
];

function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const unlimited = limit === -1;
  const pct = unlimited ? 0 : Math.min((used / limit) * 100, 100);
  const nearLimit = !unlimited && pct >= 80;

  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between text-xs text-white/50 mb-1">
        <span>{label}</span>
        <span>{unlimited ? `${used} / ∞` : `${used} / ${limit}`}</span>
      </div>
      {!unlimited && (
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${nearLimit ? 'bg-red-500' : 'bg-violet-500'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function PlanBanner({ data }: { data: PlanData }) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleChoose(plan: PlanName) {
    if (plan === 'free') return;
    setLoading(plan);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
    } catch {
      setLoading(null);
    }
  }

  async function handleManage() {
    const res = await fetch('/api/billing/portal');
    const json = await res.json();
    if (json.url) window.location.href = json.url;
  }

  return (
    <div className="mb-8">
      {/* Usage summary */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-4 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
            data.plan === 'unlimited' ? 'bg-amber-500/20 text-amber-300' :
            data.plan === 'pro'       ? 'bg-violet-500/20 text-violet-300' :
            data.plan === 'starter'   ? 'bg-emerald-500/20 text-emerald-300' :
            'bg-white/10 text-white/60'
          }`}>
            {data.planLabel}
          </span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 flex-1 min-w-0">
          <UsageBar used={data.chatbotCount} limit={data.chatbotLimit} label="Chatbots" />
          <UsageBar
            used={data.messageCount}
            limit={data.messageLimit}
            label={data.plan === 'free' ? 'Mensajes totales' : 'Mensajes este mes'}
          />
        </div>
        {data.plan !== 'free' && (
          <button
            onClick={handleManage}
            className="text-xs text-white/40 hover:text-white/70 transition px-3 py-1.5 border border-white/10 rounded-lg shrink-0"
          >
            Gestionar suscripción
          </button>
        )}
      </div>

      {/* Pricing cards — always visible */}
      {data.plan !== 'unlimited' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {PLAN_CARDS.map((card) => {
            const isCurrent = data.plan === card.id;
            return (
              <div
                key={card.id}
                className={`relative rounded-xl border p-4 flex flex-col gap-3 ${
                  card.color
                } ${isCurrent ? 'bg-white/[0.06]' : 'bg-white/[0.02]'}`}
              >
                {card.badge && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-violet-600 px-2.5 py-0.5 text-[10px] font-semibold text-white whitespace-nowrap">
                    {card.badge}
                  </span>
                )}
                <div>
                  <p className="text-xs text-white/50 font-medium">{card.name}</p>
                  <p className="text-xl font-bold mt-0.5">
                    {card.price}
                    <span className="text-sm font-normal text-white/40">{card.per}</span>
                  </p>
                </div>
                <ul className="text-xs text-white/50 space-y-1 flex-1">
                  <li>✓ {card.chatbots}</li>
                  <li>✓ {card.messages}{card.note ? ` ${card.note}` : ''}</li>
                </ul>
                {isCurrent ? (
                  <span className="block text-center text-[10px] text-white/30 py-1.5 border border-white/10 rounded-lg">
                    Plan actual
                  </span>
                ) : card.id === 'free' ? (
                  <span className="block text-center text-[10px] text-white/20 py-1.5">—</span>
                ) : (
                  <button
                    onClick={() => handleChoose(card.id)}
                    disabled={loading !== null}
                    className={`rounded-lg py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                      card.id === 'pro'
                        ? 'bg-violet-600 hover:bg-violet-500 text-white'
                        : 'bg-white/10 hover:bg-white/20 text-white'
                    }`}
                  >
                    {loading === card.id ? '…' : 'Elegir'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function NewChatbotButton({ canCreate, plan }: { canCreate: boolean; plan: PlanName }) {
  const [loading, setLoading] = useState<string | null>(null);

  async function handleUpgrade() {
    setLoading('upgrading');
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: 'starter' }),
    });
    const json = await res.json();
    if (json.url) window.location.href = json.url;
    else setLoading(null);
  }

  if (canCreate) {
    return (
      <a
        href="/"
        className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition text-center sm:text-left"
      >
        + Nuevo chatbot
      </a>
    );
  }

  return (
    <button
      onClick={plan === 'free' ? handleUpgrade : undefined}
      disabled={loading !== null}
      title="Has alcanzado el límite de chatbots de tu plan"
      className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white/50 cursor-pointer hover:bg-white/15 transition text-center sm:text-left disabled:opacity-50"
    >
      {loading ? 'Redirigiendo…' : '+ Nuevo chatbot'}
      <span className="ml-2 text-xs text-amber-400">Límite alcanzado ↑</span>
    </button>
  );
}
