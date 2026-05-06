"use client";

import { useState } from "react";
import Image from "next/image";
import { AuthForm } from "@/components/ui/sign-in-1";

const IconGithub = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...props}>
    <path d="M12 0C5.373 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.085 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12Z" fill="currentColor" />
  </svg>
);

const IconGoogle = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...props}>
    <path d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.386-7.439-7.574s3.344-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.85l3.25-3.138C18.189 1.186 15.479 0 12.24 0 5.48 0 0 5.48 0 12.24s5.48 12.24 12.24 12.24c6.885 0 11.954-4.823 11.954-12.015 0-.795-.084-1.588-.239-2.356H12.24z" fill="currentColor" />
  </svg>
);

interface Props {
  isLoggedIn: boolean;
  username?: string | null;
}

export function LandingPage({ isLoggedIn, username }: Props) {
  const [mode, setMode] = useState<"describe" | "url">("describe");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [pendingParams, setPendingParams] = useState<{ mode: string; input: string } | null>(null);

  function openLogin(params?: { mode: string; input: string }) {
    setPendingParams(params ?? null);
    setShowModal(true);
  }

  function loginWith(provider: "github" | "google") {
    const params = new URLSearchParams();
    if (pendingParams) {
      params.set("mode", pendingParams.mode);
      params.set("input", pendingParams.input);
    }
    window.location.href = `/api/auth/${provider}?${params}`;
  }

  function handleCTA() {
    const input = mode === "describe" ? description : url;
    if (!input.trim()) return;
    if (isLoggedIn) {
      const params = new URLSearchParams({ mode, input });
      window.location.href = `/create?${params}`;
    } else {
      openLogin({ mode, input });
    }
  }

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white flex flex-col">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="Chatbot Builder" width={32} height={32} className="rounded-lg" />
          <span className="font-semibold text-white/90">Chatbot Builder</span>
        </div>
        {isLoggedIn ? (
          <div className="flex items-center gap-3">
            <span className="text-sm text-white/40">Hola, {username}</span>
            <a
              href="/dashboard"
              className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition"
            >
              Mis chatbots →
            </a>
          </div>
        ) : (
          <button
            onClick={() => openLogin()}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition cursor-pointer"
          >
            Iniciar sesión
          </button>
        )}
      </nav>

      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        {/* Badge */}
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/50">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Sin código. Sin complicaciones.
        </div>

        <h1 className="text-center text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
          Crea tu chatbot{" "}
          <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            en 30 segundos
          </span>
        </h1>

        <p className="mt-5 max-w-xl text-center text-lg text-white/50">
          Describe tu negocio o pega tu web — nosotros nos encargamos del resto.
        </p>

        {/* Card */}
        <div className="mt-12 w-full max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-sm">
          <div className="flex rounded-xl bg-white/5 p-1">
            <button
              onClick={() => setMode("describe")}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer ${mode === "describe" ? "bg-white text-black shadow" : "text-white/50 hover:text-white"}`}
            >
              Describe tu negocio
            </button>
            <button
              onClick={() => setMode("url")}
              className={`flex-1 rounded-lg py-2.5 text-sm font-medium transition-all duration-200 cursor-pointer ${mode === "url" ? "bg-white text-black shadow" : "text-white/50 hover:text-white"}`}
            >
              Pega la URL de tu web
            </button>
          </div>

          {mode === "describe" && (
            <div className="mt-6">
              <label className="mb-2 block text-sm font-medium text-white/70">
                ¿A qué se dedica tu empresa?
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                placeholder="Ej: Somos una clínica dental en Madrid. Ofrecemos implantes, ortodoncia y blanqueamiento. Nuestro tono es cercano y profesional..."
                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30"
              />
              <p className="mt-2 text-right text-xs text-white/25">{description.length} caracteres</p>
            </div>
          )}

          {mode === "url" && (
            <div className="mt-6">
              <label className="mb-2 block text-sm font-medium text-white/70">URL de tu sitio web</label>
              <div className="flex gap-3">
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://tuempresa.com"
                  className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/30"
                />
              </div>
              <p className="mt-2 text-xs text-white/25">Extraeremos la información clave automáticamente.</p>
            </div>
          )}

          <button
            onClick={handleCTA}
            disabled={!(mode === "describe" ? description : url).trim()}
            className="mt-8 w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-4 text-base font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:from-violet-500 hover:to-indigo-500 hover:shadow-violet-500/30 active:scale-[0.99] cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Crear mi chatbot →
          </button>
        </div>

        <p className="mt-8 text-sm text-white/25">
          Más de <span className="font-semibold text-white/50">1.200 negocios</span> ya tienen su chatbot activo
        </p>
      </div>

      {/* Login Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}
        >
          <div className="relative w-full max-w-sm">
            <button
              onClick={() => setShowModal(false)}
              className="absolute -top-3 -right-3 z-10 h-7 w-7 rounded-full bg-white/10 border border-white/10 text-white/50 hover:text-white flex items-center justify-center text-sm transition cursor-pointer"
            >
              ✕
            </button>
            <AuthForm
              logoSrc="/logo.png"
              logoAlt="Chatbot Builder"
              title={pendingParams ? "Conecta tu cuenta" : "Iniciar sesión"}
              description={
                pendingParams
                  ? "Conecta tu cuenta para crear e inyectar tu chatbot."
                  : "Accede para gestionar tus chatbots."
              }
              primaryAction={{
                label: "Continuar con GitHub",
                icon: <IconGithub className="mr-2 h-4 w-4" />,
                onClick: () => loginWith("github"),
              }}
              secondaryActions={[
                {
                  label: "Continuar con Google",
                  icon: <IconGoogle className="mr-2 h-4 w-4" />,
                  onClick: () => loginWith("google"),
                },
              ]}
              footerContent={
                <span>
                  Al continuar aceptas nuestros{" "}
                  <u className="cursor-pointer hover:text-white transition-colors">Términos</u> y{" "}
                  <u className="cursor-pointer hover:text-white transition-colors">Privacidad</u>.
                </span>
              }
            />
          </div>
        </div>
      )}
    </main>
  );
}
