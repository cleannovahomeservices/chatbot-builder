'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckIcon, SparklesIcon } from 'lucide-react';
import type { PlanName } from '@/lib/plans';

function FilledCheck() {
  return (
    <div className="bg-violet-600 text-white rounded-full p-0.5 shrink-0">
      <CheckIcon className="size-3" strokeWidth={3} />
    </div>
  );
}

interface BentoPricingProps {
  currentPlan: PlanName;
  onChoose: (plan: Exclude<PlanName, 'free'>) => void;
  loading: string | null;
}

export function BentoPricing({ currentPlan, onChoose, loading }: BentoPricingProps) {
  function ChooseButton({ plan, highlight }: { plan: Exclude<PlanName, 'free'>; highlight?: boolean }) {
    const isCurrent = currentPlan === plan;
    if (isCurrent) {
      return (
        <Button variant="outline" disabled className="w-full opacity-50 border-white/20 text-white/40">
          Plan actual
        </Button>
      );
    }
    return (
      <Button
        onClick={() => onChoose(plan)}
        disabled={loading !== null}
        variant={highlight ? 'default' : 'outline'}
        className={cn(
          'w-full',
          highlight
            ? 'bg-violet-600 hover:bg-violet-500 text-white border-0'
            : 'border-white/20 text-white hover:bg-white/10',
        )}
      >
        {loading === plan ? 'Redirigiendo…' : 'Suscribirse'}
      </Button>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-8">

      {/* PRO — card grande destacada */}
      <div className={cn(
        'relative w-full overflow-hidden rounded-xl border border-violet-500/50 bg-violet-950/30',
        'lg:col-span-5',
      )}>
        {/* Grid decorativo de fondo */}
        <div className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'linear-gradient(to right, rgba(139,92,246,0.15) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="flex items-center gap-3 p-4 flex-wrap">
          <Badge variant="secondary" className="bg-violet-600/30 text-violet-300 border-violet-500/30">PRO</Badge>
          <Badge variant="outline" className="border-violet-400/30 text-violet-300 hidden sm:flex gap-1">
            <SparklesIcon className="size-3" /> Más popular
          </Badge>
          <div className="ml-auto">
            <ChooseButton plan="pro" highlight />
          </div>
        </div>
        <div className="flex flex-col p-4 lg:flex-row gap-4">
          <div className="lg:w-[35%]">
            <span className="font-mono text-5xl font-semibold tracking-tight text-white">10€</span>
            <span className="text-white/40 text-sm">/mes</span>
            <p className="text-white/40 text-xs mt-2">Facturación mensual</p>
          </div>
          <ul className="text-white/50 grid gap-3 text-sm lg:w-[65%]">
            {[
              '5 chatbots activos simultáneos',
              '500 mensajes al mes por cuenta',
              'Widget personalizable (colores, icono, estilo)',
              'Inyección automática en GitHub',
            ].map((f, i) => (
              <li key={i} className="flex items-center gap-3">
                <FilledCheck />
                <span className="leading-relaxed text-white/70">{f}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* STARTER */}
      <div className={cn(
        'relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]',
        'lg:col-span-3',
      )}>
        <div className="flex items-center gap-3 p-4">
          <Badge variant="secondary">STARTER</Badge>
          <div className="ml-auto">
            <ChooseButton plan="starter" />
          </div>
        </div>
        <div className="flex items-end gap-2 px-4 py-2">
          <span className="font-mono text-5xl font-semibold tracking-tight text-white">5€</span>
          <span className="text-white/40 text-sm">/mes</span>
        </div>
        <ul className="text-white/50 grid gap-3 p-4 text-sm">
          {[
            '3 chatbots activos',
            '100 mensajes al mes',
            'Widget personalizable',
          ].map((f, i) => (
            <li key={i} className="flex items-center gap-3">
              <FilledCheck />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* GRATUITO */}
      <div className={cn(
        'relative overflow-hidden rounded-xl border border-white/10 bg-white/[0.03]',
        'lg:col-span-4',
      )}>
        <div className="flex items-center gap-3 p-4">
          <Badge variant="secondary">GRATUITO</Badge>
          {currentPlan === 'free' && (
            <span className="text-xs text-white/30 ml-auto">Plan actual</span>
          )}
        </div>
        <div className="flex items-end gap-2 px-4 py-2">
          <span className="font-mono text-5xl font-semibold tracking-tight text-white">0€</span>
        </div>
        <ul className="text-white/50 grid gap-3 p-4 text-sm">
          {[
            '1 chatbot',
            '20 mensajes (total, una vez)',
            'Prueba gratuita sin tarjeta',
          ].map((f, i) => (
            <li key={i} className="flex items-center gap-3">
              <FilledCheck />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* UNLIMITED */}
      <div className={cn(
        'relative overflow-hidden rounded-xl border border-amber-500/20 bg-amber-950/10',
        'lg:col-span-4',
      )}>
        <div className="flex items-center gap-3 p-4">
          <Badge variant="secondary" className="bg-amber-500/20 text-amber-300 border-amber-400/20">UNLIMITED</Badge>
          <div className="ml-auto">
            <ChooseButton plan="unlimited" />
          </div>
        </div>
        <div className="flex items-end gap-2 px-4 py-2">
          <span className="font-mono text-5xl font-semibold tracking-tight text-white">20€</span>
          <span className="text-white/40 text-sm">/mes</span>
        </div>
        <ul className="text-white/50 grid gap-3 p-4 text-sm">
          {[
            'Chatbots ilimitados',
            'Mensajes ilimitados',
            'Sin restricciones de ningún tipo',
          ].map((f, i) => (
            <li key={i} className="flex items-center gap-3">
              <FilledCheck />
              <span>{f}</span>
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
}
