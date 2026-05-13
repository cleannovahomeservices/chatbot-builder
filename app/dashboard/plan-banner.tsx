'use client';

import { useState } from 'react';
import { PricingModal } from './pricing-modal';
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

const PLAN_COLORS: Record<PlanName, string> = {
  free:      'bg-white/10 text-white/60',
  starter:   'bg-emerald-500/20 text-emerald-300',
  pro:       'bg-violet-500/20 text-violet-300',
  unlimited: 'bg-amber-500/20 text-amber-300',
};

function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const unlimited = limit === -1;
  const pct = unlimited ? 0 : Math.min((used / limit) * 100, 100);
  const nearLimit = !unlimited && pct >= 80;

  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between text-xs text-white/50 mb-1">
        <span>{label}</span>
        <span>
          {unlimited ? `${used} / ∞` : `${used} / ${limit}`}
        </span>
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
  const [showModal, setShowModal] = useState(false);

  async function handleManage() {
    const res = await fetch('/api/billing/portal');
    const json = await res.json();
    if (json.url) window.location.href = json.url;
  }

  return (
    <>
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3 shrink-0">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${PLAN_COLORS[data.plan]}`}>
            {data.planLabel}
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 flex-1 min-w-0">
          <UsageBar
            used={data.chatbotCount}
            limit={data.chatbotLimit}
            label="Chatbots"
          />
          <UsageBar
            used={data.messageCount}
            limit={data.messageLimit}
            label={data.plan === 'free' ? 'Mensajes (total)' : `Mensajes (${data.periodLabel.split(' ')[2] ?? 'mes'})`}
          />
        </div>

        <div className="flex gap-2 shrink-0">
          {data.plan !== 'free' && (
            <button
              onClick={handleManage}
              className="text-xs text-white/40 hover:text-white/70 transition px-3 py-1.5 border border-white/10 rounded-lg"
            >
              Gestionar
            </button>
          )}
          {data.plan !== 'unlimited' && (
            <button
              onClick={() => setShowModal(true)}
              className="text-xs bg-violet-600 hover:bg-violet-500 text-white transition px-3 py-1.5 rounded-lg font-semibold"
            >
              Actualizar plan
            </button>
          )}
        </div>
      </div>

      {showModal && (
        <PricingModal currentPlan={data.plan} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}

export function NewChatbotButton({ canCreate, plan }: { canCreate: boolean; plan: PlanName }) {
  const [showModal, setShowModal] = useState(false);

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
    <>
      <button
        onClick={() => setShowModal(true)}
        title="Has alcanzado el límite de tu plan"
        className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white/40 cursor-pointer hover:bg-white/15 transition text-center sm:text-left"
      >
        + Nuevo chatbot
        <span className="ml-2 text-xs text-amber-400">Límite alcanzado</span>
      </button>
      {showModal && (
        <PricingModal currentPlan={plan} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
