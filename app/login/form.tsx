"use client";

import { useState } from "react";
import Image from "next/image";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

const IconGithub = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...props}>
    <path
      d="M12 0C5.373 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.085 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.91 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12Z"
      fill="currentColor"
    />
  </svg>
);

const IconGoogle = (props: React.SVGProps<SVGSVGElement>) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" {...props}>
    <path
      d="M12.24 10.285V14.4h6.806c-.275 1.765-2.056 5.174-6.806 5.174-4.095 0-7.439-3.386-7.439-7.574s3.344-7.574 7.439-7.574c2.33 0 3.891.989 4.785 1.85l3.25-3.138C18.189 1.186 15.479 0 12.24 0 5.48 0 0 5.48 0 12.24s5.48 12.24 12.24 12.24c6.885 0 11.954-4.823 11.954-12.015 0-.795-.084-1.588-.239-2.356H12.24z"
      fill="currentColor"
    />
  </svg>
);

interface LoginFormProps {
  mode?: string;
  input?: string;
}

export function LoginForm({ mode, input }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailAction, setEmailAction] = useState<"signin" | "signup">("signin");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isCreating = !!(mode && input);

  function loginWithGithub() {
    const params = new URLSearchParams();
    if (mode) params.set("mode", mode);
    if (input) params.set("input", input);
    window.location.href = `/api/auth/github?${params}`;
  }

  async function loginWithGoogle() {
    const next = mode && input
      ? `/create?mode=${mode}&input=${encodeURIComponent(input)}`
      : "/dashboard";
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/api/auth/supabase/callback?next=${encodeURIComponent(next)}`,
      },
    });
  }

  async function handleEmailAuth() {
    if (!email || !password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: emailAction, email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Error");
        return;
      }
      const redirectUrl =
        mode && input
          ? `/create?mode=${mode}&input=${encodeURIComponent(input)}`
          : "/dashboard";
      window.location.href = redirectUrl;
    } catch {
      setError("Error de conexión");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.03] p-8">
        <div className="flex justify-center mb-6">
          <Image
            src="/logo.png"
            alt="Chatbot Builder"
            width={48}
            height={48}
            className="rounded-xl object-contain"
          />
        </div>
        <h1 className="text-center text-2xl font-semibold text-white mb-1">
          {isCreating ? "Conecta tu cuenta" : "Iniciar sesión"}
        </h1>
        <p className="text-center text-sm text-white/40 mb-8">
          {isCreating
            ? "Conecta para crear tu chatbot automáticamente."
            : "Accede para gestionar tus chatbots."}
        </p>

        <div className="space-y-3 mb-6">
          <button
            onClick={loginWithGithub}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10 transition cursor-pointer"
          >
            <IconGithub className="h-4 w-4" />
            Continuar con GitHub
          </button>
          <button
            onClick={loginWithGoogle}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white hover:bg-white/10 transition cursor-pointer"
          >
            <IconGoogle className="h-4 w-4" />
            Continuar con Google
          </button>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-[#0A0A0A] px-2 text-white/25">o</span>
          </div>
        </div>

        <div className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              onKeyDown={(e) => e.key === "Enter" && handleEmailAuth()}
              className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-11 text-sm text-white placeholder-white/25 outline-none transition focus:border-violet-500/60 focus:ring-1 focus:ring-violet-500/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition cursor-pointer"
            >
              {showPassword ? (
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
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            onClick={handleEmailAuth}
            disabled={loading || !email || !password}
            className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 py-3 text-sm font-semibold text-white hover:from-violet-500 hover:to-indigo-500 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading
              ? "Cargando..."
              : emailAction === "signin"
              ? "Iniciar sesión"
              : "Crear cuenta"}
          </button>
          <p className="text-center text-xs text-white/25">
            {emailAction === "signin" ? (
              <>
                ¿No tienes cuenta?{" "}
                <button
                  onClick={() => setEmailAction("signup")}
                  className="text-violet-400 hover:text-violet-300 cursor-pointer"
                >
                  Crear cuenta
                </button>
              </>
            ) : (
              <>
                ¿Ya tienes cuenta?{" "}
                <button
                  onClick={() => setEmailAction("signin")}
                  className="text-violet-400 hover:text-violet-300 cursor-pointer"
                >
                  Iniciar sesión
                </button>
              </>
            )}
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-white/20">
          Al continuar aceptas nuestros{" "}
          <u className="cursor-pointer hover:text-white/40 transition">Términos</u> y{" "}
          <u className="cursor-pointer hover:text-white/40 transition">Privacidad</u>.
        </p>
      </div>
    </main>
  );
}
