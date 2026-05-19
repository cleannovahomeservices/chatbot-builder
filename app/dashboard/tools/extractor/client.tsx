'use client';

import { useEffect, useState } from 'react';
import { BentoPricing } from '@/components/ui/bento-pricing';
import type { PlanName } from '@/lib/plans';

interface HistoryItem {
  id: string;
  google_url: string;
  status: string;
  business_data: { title?: string; address?: string; totalScore?: number } | null;
  photo_urls: string[] | null;
  reviews: unknown[] | null;
  created_at: string;
}

interface ExtractionResult {
  id: string;
  title?: string;
  address?: string;
  phone?: string;
  website?: string;
  categoryName?: string;
  reviewsCount: number;
  photosCount: number;
  totalScore?: number;
  hasOpeningHours?: boolean;
}

interface PlanData {
  plan: PlanName;
  planLabel: string;
  extractionCount: number;
  extractionLimit: number;
  canExtract: boolean;
}

const IconMap = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s-8-7.5-8-13a8 8 0 0 1 16 0c0 5.5-8 13-8 13z" /><circle cx="12" cy="9" r="3" />
  </svg>
);
const IconDownload = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
  </svg>
);
const IconStar = () => (
  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="currentColor">
    <path d="M12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26z" />
  </svg>
);

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
          <h2 className="text-2xl font-bold">Necesitas más extracciones</h2>
          <p className="text-white/40 text-sm mt-1">Elige un plan para seguir extrayendo negocios. Sin permanencia, cancela cuando quieras.</p>
        </div>
        <BentoPricing currentPlan={currentPlan} onChoose={onChoose} loading={loading} />
      </div>
    </div>
  );
}

function UsageBanner({ plan, count, limit }: { plan: PlanName; count: number; limit: number }) {
  const unlimited = limit === -1;
  const pct = unlimited ? 0 : Math.min((count / limit) * 100, 100);
  const remaining = unlimited ? Infinity : Math.max(limit - count, 0);
  const atLimit = !unlimited && count >= limit;
  const nearLimit = !unlimited && remaining <= 1 && remaining > 0;

  const periodLabel = plan === 'free' ? 'plan gratuito' : 'este mes';

  return (
    <div className={`rounded-xl border p-4 mt-6 flex flex-col sm:flex-row sm:items-center gap-3 ${
      atLimit ? 'border-red-500/30 bg-red-950/20' :
      nearLimit ? 'border-amber-500/30 bg-amber-950/10' :
      'border-white/10 bg-white/[0.03]'
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-white/60 font-medium">
            Extracciones {periodLabel}
          </span>
          <span className={atLimit ? 'text-red-400 font-semibold' : nearLimit ? 'text-amber-400' : 'text-white/50'}>
            {unlimited ? `${count} / ∞` : `${count} / ${limit}`}
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
    </div>
  );
}

export function ExtractorClient({
  initialHistory,
  planData,
}: {
  initialHistory: HistoryItem[];
  planData: PlanData;
}) {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [history, setHistory] = useState(initialHistory);
  const [extractionCount, setExtractionCount] = useState(planData.extractionCount);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);

  const isUnlimited = planData.extractionLimit === -1;
  const atLimit = !isUnlimited && extractionCount >= planData.extractionLimit;

  // Auto-abrir el popup al cargar la página si ya está al límite
  useEffect(() => {
    if (atLimit) setShowUpgradeModal(true);
  }, [atLimit]);

  async function handleChooseUpgrade(plan: Exclude<PlanName, 'free'>) {
    setCheckoutLoading(plan);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
      else setCheckoutLoading(null);
    } catch {
      setCheckoutLoading(null);
    }
  }

  async function handleExtract() {
    if (!url.trim() || loading) return;

    if (atLimit) {
      setShowUpgradeModal(true);
      return;
    }

    setError('');
    setResult(null);
    setLoading(true);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 280_000);
    try {
      const res = await fetch('/api/extract-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429 && data.upgradeRequired) {
          setExtractionCount(planData.extractionLimit);
          setShowUpgradeModal(true);
          setError(data.error ?? 'Has alcanzado el límite de extracciones.');
          return;
        }
        setError(data.error ?? 'Error al extraer');
        return;
      }
      setResult(data);
      setUrl('');
      setExtractionCount(c => c + 1);

      const newItem: HistoryItem = {
        id: data.id,
        google_url: url.trim(),
        status: 'completed',
        business_data: { title: data.title, address: data.address, totalScore: data.totalScore },
        photo_urls: new Array(data.photosCount).fill(''),
        reviews: new Array(data.reviewsCount).fill(null),
        created_at: new Date().toISOString(),
      };
      setHistory([newItem, ...history.slice(0, 19)]);
    } catch (e) {
      clearTimeout(timeoutId);
      if (e instanceof DOMException && e.name === 'AbortError') {
        setError('La extracción tardó demasiado. El negocio puede tener muchas reseñas — vuelve a intentarlo o prueba con otro.');
      } else {
        setError('Error de conexión. Vuelve a intentarlo.');
      }
    } finally {
      setLoading(false);
    }
  }

  function downloadZip(id: string) {
    window.location.href = `/api/extract-business/${id}/download`;
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
      <div className="flex items-start gap-3 mb-2">
        <div className="rounded-xl bg-violet-500/10 border border-violet-500/20 p-2 text-violet-300">
          <IconMap />
        </div>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Extractor de negocios</h1>
          <p className="text-white/50 text-sm mt-1">
            Convierte cualquier negocio de Google Maps en un prompt listo para Lovable, Cursor o v0.
          </p>
        </div>
      </div>

      <UsageBanner plan={planData.plan} count={extractionCount} limit={planData.extractionLimit} />

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 mt-4">
        <label className="block text-sm font-medium text-white/70 mb-2">
          URL de Google Maps del negocio
        </label>
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.google.com/maps/place/..."
            disabled={loading}
            onKeyDown={(e) => e.key === 'Enter' && handleExtract()}
            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30 disabled:opacity-50"
          />
          <button
            onClick={handleExtract}
            disabled={!url.trim() || loading}
            className={`rounded-xl px-6 py-3 text-sm font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap ${
              atLimit
                ? 'bg-white/10 text-white/70 hover:bg-white/15'
                : 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-500 hover:to-indigo-500'
            }`}
          >
            {loading ? 'Extrayendo…' : atLimit ? 'Ampliar plan' : 'Extraer'}
          </button>
        </div>
        <p className="mt-3 text-xs text-white/40">
          Acepta links de <code className="text-white/60">google.com/maps/place/…</code>, <code className="text-white/60">maps.app.goo.gl/…</code> y <code className="text-white/60">g.page/…</code>
        </p>

        {error && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-sm text-red-300 flex items-center justify-between gap-3">
            <span>{error}</span>
            {atLimit && (
              <button
                onClick={() => setShowUpgradeModal(true)}
                className="shrink-0 rounded-lg bg-red-500 hover:bg-red-400 text-white text-xs font-semibold px-3 py-1.5 transition"
              >
                Ampliar plan
              </button>
            )}
          </div>
        )}

        {loading && (
          <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-5">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-4 w-4 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
              <p className="text-sm text-white/70">Extrayendo información del negocio…</p>
            </div>
            <p className="text-xs text-white/40">
              Esto puede tardar 1-3 minutos. Estamos descargando descripción, horarios, hasta 150 reseñas y 25 fotos en alta calidad.
            </p>
          </div>
        )}

        {result && (
          <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="min-w-0">
                <p className="text-emerald-300 text-xs font-semibold uppercase tracking-wider">¡Extracción completada!</p>
                <h3 className="text-lg font-semibold text-white mt-1 truncate">{result.title}</h3>
                {result.categoryName && <p className="text-xs text-white/40 mt-0.5">{result.categoryName}</p>}
                {result.address && <p className="text-sm text-white/50 mt-0.5 truncate">📍 {result.address}</p>}
                {result.phone && <p className="text-sm text-white/50 mt-0.5">📞 {result.phone}</p>}
                {result.website && (
                  <p className="text-sm text-white/50 mt-0.5 truncate">🌐 <a href={result.website} target="_blank" rel="noopener" className="hover:text-white/80 underline">{result.website}</a></p>
                )}
              </div>
              {typeof result.totalScore === 'number' && Number.isFinite(result.totalScore) && (
                <div className="flex items-center gap-1 text-amber-400 shrink-0">
                  <IconStar />
                  <span className="text-sm font-semibold">{result.totalScore.toFixed(1)}</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2 mb-4 text-xs">
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-white/60">
                {result.reviewsCount} {result.reviewsCount === 1 ? 'reseña' : 'reseñas'}
              </span>
              <span className="rounded-full bg-white/5 px-2.5 py-1 text-white/60">
                {result.photosCount} {result.photosCount === 1 ? 'foto' : 'fotos'}
              </span>
              {result.hasOpeningHours && (
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-white/60">Con horarios</span>
              )}
            </div>
            {(result.reviewsCount === 0 && !result.address) && (
              <div className="mb-4 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2.5 text-xs text-amber-200">
                ⚠️ Este negocio tiene info limitada en Google Maps (sin dirección física ni reseñas públicas).
                El prompt y las fotos se generan igual con lo que sí está disponible.
              </div>
            )}
            <button
              onClick={() => downloadZip(result.id)}
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-white text-black hover:bg-white/90 py-2.5 text-sm font-semibold transition"
            >
              <IconDownload />
              Descargar ZIP (prompt + fotos + reseñas)
            </button>
          </div>
        )}
      </div>

      {history.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold mb-4">Extracciones recientes</h2>
          <div className="grid gap-3">
            {history.map((item) => {
              const title = item.business_data?.title ?? 'Extracción';
              const address = item.business_data?.address;
              const rawScore = item.business_data?.totalScore;
              const score = typeof rawScore === 'number' && Number.isFinite(rawScore) ? rawScore : null;
              const photos = Array.isArray(item.photo_urls) ? item.photo_urls.length : 0;
              const reviews = Array.isArray(item.reviews) ? item.reviews.length : 0;
              const date = item.created_at
                ? new Date(item.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })
                : '';
              const failed = item.status === 'failed';

              return (
                <div
                  key={item.id}
                  className={`rounded-xl border ${failed ? 'border-red-500/20 bg-red-950/10' : 'border-white/10 bg-white/[0.03]'} p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-medium text-white truncate">{title}</h3>
                      {score !== null && (
                        <span className="flex items-center gap-0.5 text-amber-400 text-xs">
                          <IconStar />
                          {score.toFixed(1)}
                        </span>
                      )}
                      {failed && <span className="text-[10px] uppercase font-semibold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded">Falló</span>}
                    </div>
                    {address && <p className="text-xs text-white/40 mt-0.5 truncate">{address}</p>}
                    <div className="flex gap-3 text-[11px] text-white/40 mt-1.5">
                      <span>{date}</span>
                      {!failed && (
                        <>
                          <span>·</span>
                          <span>{reviews} reseñas</span>
                          <span>·</span>
                          <span>{photos} fotos</span>
                        </>
                      )}
                    </div>
                  </div>
                  {!failed && (
                    <button
                      onClick={() => downloadZip(item.id)}
                      className="shrink-0 flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 text-xs font-medium text-white/80 hover:text-white transition"
                    >
                      <IconDownload />
                      Descargar
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {history.length === 0 && !result && !loading && (
        <div className="mt-10 rounded-2xl border border-dashed border-white/10 p-8 text-center">
          <p className="text-white/40 text-sm mb-1">Aún no has extraído ningún negocio.</p>
          <p className="text-white/30 text-xs">
            Pega arriba un link de Google Maps para empezar.
          </p>
        </div>
      )}

      <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h3 className="text-sm font-semibold text-white mb-3">¿Cómo funciona?</h3>
        <ol className="space-y-2 text-sm text-white/60">
          <li className="flex gap-3">
            <span className="rounded-full bg-violet-500/20 text-violet-300 h-5 w-5 flex items-center justify-center text-[11px] font-semibold shrink-0">1</span>
            <span>Busca el negocio en Google Maps y copia su URL.</span>
          </li>
          <li className="flex gap-3">
            <span className="rounded-full bg-violet-500/20 text-violet-300 h-5 w-5 flex items-center justify-center text-[11px] font-semibold shrink-0">2</span>
            <span>Pégalo aquí y dale a Extraer. Sacamos descripción, horarios, teléfono, fotos en HD y reseñas reales.</span>
          </li>
          <li className="flex gap-3">
            <span className="rounded-full bg-violet-500/20 text-violet-300 h-5 w-5 flex items-center justify-center text-[11px] font-semibold shrink-0">3</span>
            <span>Descarga el ZIP. Dentro hay un <code className="text-white/80">prompt.md</code> listo para pegar en Lovable, Cursor, v0 o Bolt.</span>
          </li>
        </ol>
      </div>

      {showUpgradeModal && (
        <PricingModal
          currentPlan={planData.plan}
          onClose={() => setShowUpgradeModal(false)}
          onChoose={handleChooseUpgrade}
          loading={checkoutLoading}
        />
      )}
    </div>
  );
}
