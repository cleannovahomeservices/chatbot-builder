'use client';

import { useEffect, useState } from 'react';
import { BentoPricing } from '@/components/ui/bento-pricing';
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
  cancelAt?: string | null;
  currentPeriodEnd?: string | null;
  subscriptionStatus?: string | null;
}

function formatDateEs(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
}

function CancellationBanner({ cancelAt, planLabel, onReactivated }: {
  cancelAt: string;
  planLabel: string;
  onReactivated: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReactivate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/reactivate', { method: 'POST' });
      if (!res.ok) throw new Error('No se pudo reactivar');
      onReactivated();
    } catch {
      setError('No se pudo reactivar. Intenta de nuevo.');
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
      <div>
        <p className="text-sm font-semibold text-amber-300">
          Tu plan {planLabel} termina el {formatDateEs(cancelAt)}
        </p>
        <p className="text-xs text-white/40 mt-0.5">
          Después pasarás al plan Gratuito automáticamente. No se te volverá a cobrar.
          {error && <span className="text-red-400 ml-2">{error}</span>}
        </p>
      </div>
      <button
        onClick={handleReactivate}
        disabled={loading}
        className="shrink-0 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-semibold px-3 py-2 transition disabled:opacity-50"
      >
        {loading ? 'Reactivando…' : 'Reactivar'}
      </button>
    </div>
  );
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
  const atLimit = !unlimited && used >= limit;

  return (
    <div className="flex-1 min-w-0">
      <div className="flex justify-between text-xs mb-1">
        <span className="text-white/50">{label}</span>
        <span className={atLimit ? 'text-red-400 font-semibold' : nearLimit ? 'text-amber-400' : 'text-white/50'}>
          {unlimited ? `${used} / ∞` : `${used} / ${limit}`}
        </span>
      </div>
      {!unlimited && (
        <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              atLimit ? 'bg-red-500' : nearLimit ? 'bg-amber-500' : 'bg-violet-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

function MessagesWarning({
  used, limit, plan, onUpgrade,
}: { used: number; limit: number; plan: PlanName; onUpgrade: () => void }) {
  if (plan === 'unlimited' || limit === -1) return null;
  const remaining = limit - used;
  if (remaining > 5) return null;

  if (remaining <= 0) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 flex items-center justify-between gap-4 mb-4">
        <div>
          <p className="text-sm font-semibold text-red-300">Sin mensajes disponibles</p>
          <p className="text-xs text-white/40 mt-0.5">
            {plan === 'free'
              ? 'Has usado los 20 mensajes del plan gratuito.'
              : 'Has alcanzado el límite mensual de mensajes.'}
          </p>
        </div>
        <button
          onClick={onUpgrade}
          className="shrink-0 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-semibold px-3 py-2 transition"
        >
          Ampliar plan
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 px-4 py-3 flex items-center justify-between gap-4 mb-4">
      <p className="text-sm text-amber-300">
        Te {remaining === 1 ? 'queda' : 'quedan'} <strong>{remaining}</strong> mensaje{remaining !== 1 ? 's' : ''} en tu plan.
      </p>
      <button
        onClick={onUpgrade}
        className="shrink-0 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-xs font-semibold px-3 py-2 transition"
      >
        Ampliar plan
      </button>
    </div>
  );
}

function PricingModal({ currentPlan, onClose, onChoose, loading }: {
  currentPlan: PlanName;
  onClose: () => void;
  onChoose: (plan: Exclude<PlanName, 'free'>) => void;
  loading: string | null;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 px-4 py-8 overflow-y-auto"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-4xl rounded-2xl border border-white/10 bg-[#0d0d0d] p-6 sm:p-8 my-auto">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white/30 hover:text-white text-xl leading-none"
        >
          ✕
        </button>
        <div className="mb-6 text-center">
          <h2 className="text-2xl font-bold">Elige tu plan</h2>
          <p className="text-white/40 text-sm mt-1">Sin permanencia. Cancela cuando quieras.</p>
        </div>
        <BentoPricing currentPlan={currentPlan} onChoose={onChoose} loading={loading} />
      </div>
    </div>
  );
}

export function PlanBanner({ data }: { data: PlanData }) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  // Auto-abrir el modal si se quedó sin mensajes
  useEffect(() => {
    if (data.plan !== 'unlimited' && data.messageLimit !== -1 && data.messageCount >= data.messageLimit) {
      setShowModal(true);
    }
  }, [data.messageCount, data.messageLimit, data.plan]);

  async function handleChoose(plan: Exclude<PlanName, 'free'>) {
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
    <>
      {/* Aviso de cancelación programada */}
      {data.cancelAt && data.plan !== 'free' && (
        <CancellationBanner
          cancelAt={data.cancelAt}
          planLabel={data.planLabel}
          onReactivated={() => window.location.reload()}
        />
      )}

      {/* Aviso de mensajes bajos */}
      <MessagesWarning
        used={data.messageCount}
        limit={data.messageLimit}
        plan={data.plan}
        onUpgrade={() => setShowModal(true)}
      />

      {/* Resumen de uso */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold shrink-0 ${PLAN_COLORS[data.plan]}`}>
          {data.planLabel}
        </span>

        <div className="flex flex-col sm:flex-row gap-3 flex-1 min-w-0">
          <UsageBar used={data.chatbotCount} limit={data.chatbotLimit} label="Chatbots" />
          <UsageBar
            used={data.messageCount}
            limit={data.messageLimit}
            label={data.plan === 'free' ? 'Mensajes (total)' : 'Mensajes (mes)'}
          />
        </div>

        <div className="flex gap-2 shrink-0">
          {data.plan !== 'free' && (
            <button
              onClick={handleManage}
              className="text-xs text-white/40 hover:text-white/60 transition px-3 py-1.5 border border-white/10 rounded-lg"
            >
              Gestionar
            </button>
          )}
          {data.plan !== 'unlimited' && (
            <button
              onClick={() => setShowModal(true)}
              className="text-xs bg-violet-600 hover:bg-violet-500 text-white transition px-3 py-1.5 rounded-lg font-semibold"
            >
              Ampliar plan
            </button>
          )}
        </div>
      </div>

      {showModal && (
        <PricingModal
          currentPlan={data.plan}
          onClose={() => setShowModal(false)}
          onChoose={handleChoose}
          loading={loading}
        />
      )}
    </>
  );
}

export function NewChatbotButton({ canCreate, plan }: { canCreate: boolean; plan: PlanName }) {
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  async function handleChoose(p: Exclude<PlanName, 'free'>) {
    setLoading(p);
    const res = await fetch('/api/billing/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan: p }),
    });
    const json = await res.json();
    if (json.url) window.location.href = json.url;
    else setLoading(null);
  }

  if (canCreate) {
    return (
      <a
        href="/"
        className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition text-center"
      >
        + Nuevo chatbot
      </a>
    );
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-semibold text-white/50 hover:bg-white/15 transition text-center"
      >
        + Nuevo chatbot
        <span className="ml-2 text-xs text-amber-400">Ampliar plan ↑</span>
      </button>
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 px-4 py-8 overflow-y-auto"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="relative w-full max-w-4xl rounded-2xl border border-white/10 bg-[#0d0d0d] p-6 sm:p-8 my-auto">
            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-white/30 hover:text-white text-xl">✕</button>
            <div className="mb-6 text-center">
              <h2 className="text-2xl font-bold">Elige tu plan</h2>
              <p className="text-white/40 text-sm mt-1">Sin permanencia. Cancela cuando quieras.</p>
            </div>
            <BentoPricing currentPlan={plan} onChoose={handleChoose} loading={loading} />
          </div>
        </div>
      )}
    </>
  );
}
