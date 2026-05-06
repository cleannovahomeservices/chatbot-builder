"use client";

import { AuthForm } from "@/components/ui/sign-in-1";

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
  function loginWithGithub() {
    const params = new URLSearchParams();
    if (mode) params.set("mode", mode);
    if (input) params.set("input", input);
    window.location.href = `/api/auth/github?${params}`;
  }

  const isCreating = !!(mode && input);

  return (
    <main className="min-h-screen bg-[#0A0A0A] flex items-center justify-center px-4">
      <AuthForm
        logoSrc="/logo.png"
        logoAlt="Chatbot Builder"
        title={isCreating ? "Conecta tu cuenta" : "Iniciar sesión"}
        description={
          isCreating
            ? "Conecta GitHub para crear e inyectar tu chatbot automáticamente."
            : "Accede para gestionar tus chatbots."
        }
        primaryAction={{
          label: "Continuar con GitHub",
          icon: <IconGithub className="mr-2 h-4 w-4" />,
          onClick: loginWithGithub,
        }}
        secondaryActions={[
          {
            label: "Continuar con Google (próximamente)",
            icon: <IconGoogle className="mr-2 h-4 w-4" />,
            onClick: () => {},
            disabled: true,
          },
        ]}
        footerContent={
          <span>
            Al continuar aceptas nuestros{" "}
            <u className="cursor-pointer hover:text-white transition-colors">Términos de Servicio</u>
            {" "}y{" "}
            <u className="cursor-pointer hover:text-white transition-colors">Política de Privacidad</u>.
          </span>
        }
      />
    </main>
  );
}
