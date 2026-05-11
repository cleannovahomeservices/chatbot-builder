"use client";

import { useState } from 'react';

const SECTIONS = [
  {
    title: 'GitHub',
    icon: '⑂',
    items: [
      {
        q: 'La inyección no funcionó y solo se creó un PR',
        a: 'Tu rama principal está protegida (branch protection rules en GitHub). El sistema crea un Pull Request automáticamente — ábrelo en GitHub y pulsa "Merge pull request". El widget se activará tras el merge.',
      },
      {
        q: 'El widget no se inyectó y el repo es privado',
        a: 'GitHub OAuth concede acceso a repos públicos y privados por igual. Si la inyección falló, revisa que el repo esté seleccionado correctamente y vuelve a intentarlo con "Forzar re-inyección" en el panel de personalización.',
      },
      {
        q: 'No tengo GitHub o no quiero conectarlo',
        a: 'Usa la opción "Descargar chatbot" al crear. Obtendrás un archivo .md que puedes pegar en Cursor, Lovable, Replit o Claude Code y el asistente integra el widget automáticamente.',
      },
    ],
  },
  {
    title: 'Vercel',
    icon: '▲',
    items: [
      {
        q: 'Conecté Vercel pero el widget no aparece en producción',
        a: 'Si creaste el proyecto en Vercel antes de conectarlo a GitHub, el primer deploy va a Preview, no a Production. Ve a Vercel → tu proyecto → Deployments → selecciona el último → "Promote to Production".',
      },
      {
        q: 'Vercel no puede acceder a mi repo privado',
        a: 'Vercel necesita permisos explícitos sobre repos privados. Ve a Vercel → Settings → Git → y asegúrate de que el repo está en la lista de repositorios autorizados. En plan gratuito, los repos privados están disponibles pero requieren autorización manual.',
      },
      {
        q: 'El deploy en Vercel está en estado "Building" o "Error"',
        a: 'El widget inyectado es solo HTML estático — no debería causar errores de build. Si el build falla, el problema es independiente del chatbot. Revisa los logs de Vercel para ver el error real.',
      },
    ],
  },
  {
    title: 'Widget en la web',
    icon: '◉',
    items: [
      {
        q: 'El widget aparece dos veces en mi web',
        a: 'Ocurre si el widget se inyectó varias veces (por ejemplo, tras varias re-inyecciones). Ve al archivo donde se inyectó en tu repo (normalmente index.html, layout.tsx o _document.tsx) y elimina los bloques duplicados manualmente. Solo debe quedar uno.',
      },
      {
        q: 'Inyecté el widget pero no aparece en la web',
        a: 'Espera 2–5 minutos a que el CDN invalide el caché. Luego haz hard refresh: Ctrl+Shift+R (Windows) o Cmd+Shift+R (Mac). Si sigue sin aparecer, verifica que el archivo donde se inyectó es el que realmente se sirve en producción.',
      },
      {
        q: 'El widget está bloqueado por Content Security Policy (CSP)',
        a: 'Si tu web tiene cabeceras CSP, el navegador bloqueará el script. Añade www.botluma.com a las directivas script-src y connect-src de tu configuración de servidor (next.config.js, vercel.json, nginx, etc.).',
      },
      {
        q: 'El widget se ve bien en local pero no en producción',
        a: 'Asegúrate de que el archivo modificado (layout.tsx, index.html, etc.) está commiteado y el deploy de producción ya terminó. Verifica en el historial de commits de GitHub que el cambio está incluido.',
      },
    ],
  },
  {
    title: 'Chatbot y respuestas',
    icon: '💬',
    items: [
      {
        q: 'El chatbot dice "no tengo esa información" para precios o servicios que sí existen',
        a: 'El prompt generado es demasiado genérico. Abre el panel de personalización → "Regenerar desde web" (si tienes URL guardada) o edita el prompt manualmente e incluye los precios y servicios reales con datos concretos.',
      },
      {
        q: 'El chatbot responde pero siempre redirige al equipo humano',
        a: 'El sistema prompt incluye una regla de derivación demasiado amplia. Edita el prompt en el panel de personalización y ajusta la sección de derivación para que solo aplique a quejas o peticiones explícitas de hablar con una persona.',
      },
      {
        q: 'El chatbot no recuerda lo que dije antes en la conversación',
        a: 'El historial de conversación dura 30 minutos desde el último mensaje y guarda los últimos 20 intercambios. Si pasa más tiempo o recargas la página, la sesión se reinicia. Es el comportamiento esperado.',
      },
    ],
  },
  {
    title: 'Scraping y generación de prompt',
    icon: '🔍',
    items: [
      {
        q: 'La web es de Replit y el scraping falla o devuelve basura',
        a: 'Las apps de Replit en plan gratuito se duermen tras 5 minutos sin visitas. Abre la URL en el navegador, espera a que cargue del todo (5–15 segundos), y justo después dale a "Regenerar desde web". Mientras el app esté despierto, el scraping funciona.',
      },
      {
        q: 'El scraping no extrajo el teléfono o la dirección',
        a: 'Algunos sitios muestran el contacto mediante animaciones con IntersectionObserver que se activan al hacer scroll. El scraper ya intenta capturarlas, pero si falla, añade el teléfono y dirección manualmente en el panel de personalización editando el prompt.',
      },
      {
        q: '"Regenerar desde web" no hace nada o dice que no hay URL',
        a: 'El botón solo aparece si creaste el chatbot pegando una URL (no usando el modo "Describe tu negocio"). Si usaste el modo de texto libre, no hay URL guardada — edita el prompt directamente en el panel.',
      },
      {
        q: 'El prompt generado no tiene información real del negocio',
        a: 'El scraper obtuvo contenido de mala calidad (páginas de error, arte ASCII). Ocurre cuando el sitio está caído, bloquea scrapers, o requiere login. Edita el prompt manualmente con los datos reales del negocio.',
      },
    ],
  },
];

export function HelpWidget() {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        title="Ayuda y solución de problemas"
        className="fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-[#1a1a1a] text-white/60 shadow-lg hover:border-violet-500/40 hover:text-violet-400 hover:bg-violet-500/10 transition-all cursor-pointer"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Slide-in panel */}
      <div className={`fixed top-0 right-0 z-50 h-full w-full max-w-md bg-[#111] border-l border-white/10 shadow-2xl flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 shrink-0">
          <div>
            <h2 className="font-semibold text-white">Solución de problemas</h2>
            <p className="text-xs text-white/40 mt-0.5">Errores frecuentes y cómo resolverlos</p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-white/40 hover:text-white transition text-2xl leading-none cursor-pointer"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {SECTIONS.map((section) => (
            <div key={section.title}>
              <div className="flex items-center gap-2 px-2 mb-2">
                <span className="text-sm">{section.icon}</span>
                <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">{section.title}</span>
              </div>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const key = `${section.title}:${item.q}`;
                  const isOpen = expanded === key;
                  return (
                    <div key={item.q} className="rounded-xl border border-white/8 bg-white/[0.03] overflow-hidden">
                      <button
                        onClick={() => setExpanded(isOpen ? null : key)}
                        className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left cursor-pointer hover:bg-white/5 transition-colors"
                      >
                        <span className="text-sm text-white/80 leading-snug">{item.q}</span>
                        <svg
                          className={`h-4 w-4 shrink-0 text-white/30 mt-0.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4">
                          <p className="text-sm text-white/55 leading-relaxed">{item.a}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
