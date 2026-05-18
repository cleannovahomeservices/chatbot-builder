'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface ExtractionResult {
  id: string;
  title?: string;
  address?: string;
  reviewsCount: number;
  photosCount: number;
  totalScore?: number;
}

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

export function PublicExtractorClient() {
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ExtractionResult | null>(null);
  const [limitReached, setLimitReached] = useState(false);

  async function handleExtract() {
    if (!url.trim() || loading) return;
    setError('');
    setResult(null);
    setLimitReached(false);
    setLoading(true);
    try {
      const res = await fetch('/api/extract-business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (res.status === 429) setLimitReached(true);
        setError(data.error ?? 'Error al extraer');
        return;
      }
      setResult(data);
      setUrl('');
    } catch {
      setError('Error de conexión. Vuelve a intentarlo.');
    } finally {
      setLoading(false);
    }
  }

  function downloadZip(id: string) {
    window.location.href = `/api/extract-business/${id}/download`;
  }

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white">
      <nav className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/5">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="BotLuma" width={32} height={32} className="rounded-lg" />
          <span className="font-semibold text-white/90">BotLuma</span>
        </Link>
        <Link
          href="/"
          className="rounded-xl border border-white/10 bg-white/5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition whitespace-nowrap"
        >
          Crear mi chatbot
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/50 mb-6">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Herramienta gratis · 2 extracciones por mes
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight">
            Extrae cualquier negocio de{' '}
            <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
              Google Maps
            </span>
          </h1>
          <p className="mt-4 text-base sm:text-lg text-white/50 max-w-xl mx-auto">
            Reseñas reales, fotos en HD, horarios, teléfono, descripción. Todo empaquetado en un prompt listo para{' '}
            <strong className="text-white/80">Lovable, Cursor, v0 o Bolt</strong>.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <label className="block text-sm font-medium text-white/70 mb-2">
            Pega la URL de Google Maps del negocio
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
              className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {loading ? 'Extrayendo…' : 'Extraer gratis'}
            </button>
          </div>
          <p className="mt-3 text-xs text-white/40">
            Funciona con links de <code className="text-white/60">google.com/maps</code>, <code className="text-white/60">maps.app.goo.gl</code> y <code className="text-white/60">g.page</code>
          </p>

          {error && (
            <div className={`mt-4 rounded-xl border ${limitReached ? 'border-amber-500/30 bg-amber-950/20' : 'border-red-500/30 bg-red-950/30'} px-4 py-3`}>
              <p className={`text-sm ${limitReached ? 'text-amber-300' : 'text-red-300'}`}>{error}</p>
              {limitReached && (
                <Link
                  href="/login?next=/dashboard/tools/extractor"
                  className="inline-block mt-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-200 text-xs font-semibold px-3 py-2 transition"
                >
                  Crear cuenta gratis para más extracciones →
                </Link>
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
                Suele tardar 1-3 minutos. Estamos descargando hasta 150 reseñas y 25 fotos en HD.
              </p>
            </div>
          )}

          {result && (
            <div className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="min-w-0">
                  <p className="text-emerald-300 text-xs font-semibold uppercase tracking-wider">¡Listo!</p>
                  <h3 className="text-lg font-semibold text-white mt-1 truncate">{result.title}</h3>
                  {result.address && <p className="text-sm text-white/50 mt-0.5 truncate">{result.address}</p>}
                </div>
                {result.totalScore !== undefined && (
                  <div className="flex items-center gap-1 text-amber-400 shrink-0">
                    <IconStar />
                    <span className="text-sm font-semibold">{result.totalScore.toFixed(1)}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 mb-4 text-xs">
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-white/60">{result.reviewsCount} reseñas</span>
                <span className="rounded-full bg-white/5 px-2.5 py-1 text-white/60">{result.photosCount} fotos</span>
              </div>
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

        <div className="mt-10 grid sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-2xl mb-1">📸</p>
            <p className="text-sm font-semibold text-white">Fotos en HD</p>
            <p className="text-xs text-white/40 mt-1">Hasta 25 fotos descargadas en alta calidad con URLs permanentes.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-2xl mb-1">⭐</p>
            <p className="text-sm font-semibold text-white">Reseñas reales</p>
            <p className="text-xs text-white/40 mt-1">Hasta 150 reseñas con autor, puntuación y fecha — perfectas como testimonios.</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-2xl mb-1">🤖</p>
            <p className="text-sm font-semibold text-white">Prompt optimizado</p>
            <p className="text-xs text-white/40 mt-1">Markdown listo para Lovable, Cursor, v0 o Bolt. Pegar y construir.</p>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-white/10 bg-gradient-to-br from-violet-600/10 to-indigo-600/10 p-6 text-center">
          <p className="text-sm text-white/60 mb-3">
            ¿Trabajas con muchos negocios? Crea una cuenta gratis y haz hasta 5 extracciones por mes.
          </p>
          <Link
            href="/login?next=/dashboard/tools/extractor"
            className="inline-block rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition"
          >
            Crear cuenta gratis
          </Link>
        </div>
      </div>
    </main>
  );
}
