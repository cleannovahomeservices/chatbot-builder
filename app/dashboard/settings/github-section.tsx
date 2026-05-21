'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface Props {
  connected: boolean;
  username: string | null;
}

export function GithubSection({ connected, username }: Props) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [showGuide, setShowGuide] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (searchParams.get('disconnected') === 'github') {
      setShowGuide(true);
    }
  }, [searchParams]);

  function dismissGuide() {
    setShowGuide(false);
    router.replace('/dashboard/settings');
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <dt className="text-white/50">GitHub</dt>
        <dd className="flex items-center gap-3">
          {connected ? (
            <>
              <span className="text-emerald-400">
                Conectado{username ? ` (@${username})` : ''}
              </span>
              {confirming ? (
                <>
                  <a
                    href="/api/auth/github/revoke"
                    className="text-xs text-red-400 hover:text-red-300"
                  >
                    Confirmar
                  </a>
                  <button
                    onClick={() => setConfirming(false)}
                    className="text-xs text-white/40 hover:text-white/60"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirming(true)}
                  className="text-xs text-white/40 hover:text-red-400 transition"
                >
                  Desconectar
                </button>
              )}
            </>
          ) : (
            <a
              href="/api/auth/github?next=/dashboard/settings"
              className="text-violet-400 hover:text-violet-300"
            >
              Conectar →
            </a>
          )}
        </dd>
      </div>

      {showGuide && (
        <div className="mt-4 rounded-xl border border-violet-500/30 bg-violet-500/5 p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <p className="font-medium text-white">
                GitHub desconectado correctamente
              </p>
              <p className="text-white/60">
                Para conectar una cuenta de GitHub <strong>diferente</strong>, sigue estos pasos:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-white/70 ml-1">
                <li>
                  <a
                    href="https://github.com/logout"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
                  >
                    Cierra sesión en GitHub.com ↗
                  </a>{' '}
                  <span className="text-white/40">(se abre en una pestaña nueva)</span>
                </li>
                <li>
                  Inicia sesión en GitHub con la cuenta que quieres usar
                </li>
                <li>
                  Vuelve aquí y haz clic en{' '}
                  <a
                    href="/api/auth/github?next=/dashboard/settings"
                    className="text-violet-400 hover:text-violet-300 underline underline-offset-2"
                  >
                    Conectar GitHub
                  </a>
                </li>
              </ol>
              <p className="text-xs text-white/40 pt-1">
                GitHub no permite elegir cuenta desde nuestra app (a diferencia de Google).
                Por eso necesitas cerrar sesión en github.com primero.
              </p>
            </div>
            <button
              onClick={dismissGuide}
              className="text-white/40 hover:text-white/80 shrink-0"
              aria-label="Cerrar"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
