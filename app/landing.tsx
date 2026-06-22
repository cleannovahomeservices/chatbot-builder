"use client";

import { useState } from "react";
import Image from "next/image";

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
  const [emailAddress, setEmailAddress] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [showEmailPassword, setShowEmailPassword] = useState(false);
  const [emailAction, setEmailAction] = useState<"signin" | "signup">("signin");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState("");

  function openLogin(params?: { mode: string; input: string }) {
    setPendingParams(params ?? null);
    setShowModal(true);
    setEmailError("");
  }

  function loginWithGithub() {
    const params = new URLSearchParams();
    if (pendingParams) {
      params.set("mode", pendingParams.mode);
      params.set("input", pendingParams.input);
    }
    window.location.href = `/api/auth/github?${params}`;
  }

  function loginWithGoogle() {
    const next = pendingParams
      ? `/create?mode=${pendingParams.mode}&input=${encodeURIComponent(pendingParams.input)}`
      : "/dashboard";
    window.location.href = `/api/auth/google?next=${encodeURIComponent(next)}`;
  }

  async function handleEmailAuth() {
    if (!emailAddress || !emailPassword) return;
    setEmailLoading(true);
    setEmailError("");
    try {
      const res = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: emailAction, email: emailAddress, password: emailPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setEmailError(data.error ?? "Error"); return; }
      const redirectUrl = pendingParams
        ? `/create?mode=${pendingParams.mode}&input=${encodeURIComponent(pendingParams.input)}`
        : "/dashboard";
      window.location.href = redirectUrl;
    } catch {
      setEmailError("Error de conexión");
    } finally {
      setEmailLoading(false);
    }
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
      <nav className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-white/5">
        <div className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="Chatbot Builder" width={32} height={32} className="rounded-lg" />
          <span className="font-semibold text-white/90 whitespace-nowrap">Chatbot Builder</span>
        </div>
        {isLoggedIn ? (
          <div className="flex items-center gap-2 sm:gap-3">
            <span className="hidden sm:block text-sm text-white/40 truncate max-w-[160px]">Hola, {username}</span>
            <a
              href="/dashboard"
              className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3 sm:px-4 py-2 text-sm font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition whitespace-nowrap"
            >
              Dashboard →
            </a>
          </div>
        ) : (
          <button
            onClick={() => openLogin()}
            className="rounded-xl border border-white/10 bg-white/5 px-3 sm:px-4 py-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white transition cursor-pointer whitespace-nowrap"
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

        <h1 className="text-center text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl">
          Crea tu chatbot{" "}
          <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            en 30 segundos
          </span>
        </h1>

        <p className="mt-5 max-w-xl text-center text-lg text-white/50">
          Describe tu negocio o pega tu web — nosotros nos encargamos del resto.
        </p>

        {/* Card */}
        <div className="mt-10 w-full max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-8 backdrop-blur-sm">
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
          <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#0f0f0f] p-8">
            <button
              onClick={() => setShowModal(false)}
              className="absolute -top-3 -right-3 z-10 h-7 w-7 rounded-full bg-white/10 border border-white/10 text-white/50 hover:text-white flex items-center justify-center text-sm transition cursor-pointer"
            >
              ✕
            </button>

            <div className="flex justify-center mb-5">
              <Image src="/logo.png" alt="Chatbot Builder" width={44} height={44} className="rounded-xl object-contain" />
            </div>
            <h2 className="text-center text-xl font-semibold text-white mb-1">
              {pendingParams ? "Conecta tu cuenta" : "Iniciar sesión"}
            </h2>
            <p className="text-center text-sm text-white/40 mb-7">
              {pendingParams ? "Conecta para crear tu chatbot." : "Accede para gestionar tus chatbots."}
            </p>

            <div className="space-y-2.5 mb-5">
              <button
                onClick={loginWithGithub}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition cursor-pointer"
              >
                <IconGithub className="h-4 w-4" />
                Continuar con GitHub
              </button>
              <button
                onClick={loginWithGoogle}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/10 transition cursor-pointer"
              >
                <IconGoogle className="h-4 w-4" />
                Continuar con Google
              </button>
            </div>

            <div className="relative mb-5">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-[#0f0f0f] px-2 text-white/25">o</span>
              </div>
            </div>

            <div className="space-y-2.5">
              <input
                type="email"
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                placeholder="tu@email.com"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none transition focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20"
              />
              <div className="relative">
                <input
                  type={showEmailPassword ? "text" : "password"}
                  value={emailPassword}
                  onChange={(e) => setEmailPassword(e.target.value)}
                  placeholder="Contraseña"
                  onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 pr-11 text-sm text-white placeholder-white/25 outline-none transition focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20"
                />
                <button
                  type="button"
                  onClick={() => setShowEmailPassword(!showEmailPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition cursor-pointer"
                >
                  {showEmailPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {emailError && <p className="text-xs text-red-400">{emailError}</p>}
              <button
                onClick={handleEmailAuth}
                disabled={emailLoading || !emailAddress || !emailPassword}
                className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-2.5 text-sm font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                {emailLoading ? "Cargando..." : emailAction === "signin" ? "Iniciar sesión" : "Crear cuenta"}
              </button>
              <p className="text-center text-xs text-white/25">
                {emailAction === "signin" ? (
                  <>¿No tienes cuenta?{" "}
                    <button onClick={() => setEmailAction("signup")} className="text-violet-400 hover:text-violet-300 cursor-pointer">Crear cuenta</button>
                  </>
                ) : (
                  <>¿Ya tienes cuenta?{" "}
                    <button onClick={() => setEmailAction("signin")} className="text-violet-400 hover:text-violet-300 cursor-pointer">Iniciar sesión</button>
                  </>
                )}
              </p>
            </div>

            <p className="mt-5 text-center text-xs text-white/20">
              Al continuar aceptas nuestros{" "}
              <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/40 transition">Términos</a> y{" "}
              <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/40 transition">Privacidad</a>.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}
