import Link from "next/link";

export const metadata = {
  title: "Política de Privacidad — BotLuma",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] px-4 py-16 text-white">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition"
        >
          ← Volver
        </Link>

        <h1 className="mb-2 text-3xl font-bold">Política de Privacidad</h1>
        <p className="mb-10 text-sm text-white/40">Última actualización: junio 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-white/70">
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">1. Responsable del tratamiento</h2>
            <p>
              BotLuma es el responsable del tratamiento de tus datos personales. Puedes
              contactarnos en{" "}
              <a
                href="mailto:cranzcanal@gmail.com"
                className="text-violet-400 hover:text-violet-300 transition"
              >
                cranzcanal@gmail.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">2. Datos que recogemos</h2>
            <p className="mb-2">Recogemos los siguientes datos cuando usas el Servicio:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong className="text-white/90">Datos de cuenta:</strong> nombre, dirección de
                email, foto de perfil y nombre de usuario, proporcionados al registrarte o al
                conectar tu cuenta de GitHub o Google.
              </li>
              <li>
                <strong className="text-white/90">Datos de uso:</strong> chatbots creados,
                número de mensajes procesados y actividad en el Servicio.
              </li>
              <li>
                <strong className="text-white/90">Datos de pago:</strong> gestionados
                íntegramente por Stripe. No almacenamos números de tarjeta ni datos bancarios.
              </li>
              <li>
                <strong className="text-white/90">Datos técnicos:</strong> dirección IP, tipo
                de navegador y registros de acceso, necesarios para el funcionamiento y seguridad
                del Servicio.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">3. Finalidad del tratamiento</h2>
            <p className="mb-2">Usamos tus datos para:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Crear y gestionar tu cuenta.</li>
              <li>Prestar el Servicio y sus funcionalidades.</li>
              <li>Procesar pagos y gestionar suscripciones.</li>
              <li>Enviarte comunicaciones relacionadas con el Servicio (no publicidad no solicitada).</li>
              <li>Detectar y prevenir fraude o usos indebidos.</li>
              <li>Cumplir obligaciones legales.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">4. Base legal</h2>
            <p>
              El tratamiento de tus datos se basa en la ejecución del contrato de prestación del
              Servicio (art. 6.1.b RGPD), en nuestro interés legítimo en la seguridad y mejora
              del Servicio (art. 6.1.f RGPD) y, cuando corresponda, en el cumplimiento de
              obligaciones legales (art. 6.1.c RGPD).
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">5. Terceros y transferencias</h2>
            <p className="mb-2">Compartimos datos únicamente con los siguientes proveedores:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong className="text-white/90">Supabase</strong> — base de datos y
                autenticación (servidores en la UE).
              </li>
              <li>
                <strong className="text-white/90">Vercel</strong> — infraestructura de alojamiento.
              </li>
              <li>
                <strong className="text-white/90">Stripe</strong> — procesamiento de pagos.
              </li>
              <li>
                <strong className="text-white/90">OpenAI / Anthropic</strong> — modelos de IA
                para generar respuestas del chatbot.
              </li>
            </ul>
            <p className="mt-2">
              Todos los proveedores están sujetos a acuerdos de tratamiento de datos conformes
              al RGPD. No vendemos tus datos a terceros.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">6. Conservación</h2>
            <p>
              Conservamos tus datos mientras mantengas una cuenta activa. Tras la eliminación de
              la cuenta, tus datos se borran en un plazo máximo de 30 días, salvo que la ley
              exija conservarlos durante más tiempo.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">7. Tus derechos</h2>
            <p className="mb-2">
              De acuerdo con el RGPD, tienes derecho a:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Acceder a tus datos personales.</li>
              <li>Rectificar datos inexactos.</li>
              <li>Solicitar la supresión ("derecho al olvido").</li>
              <li>Oponerte al tratamiento o solicitar su limitación.</li>
              <li>Solicitar la portabilidad de tus datos.</li>
            </ul>
            <p className="mt-2">
              Ejerce tus derechos escribiéndonos a{" "}
              <a
                href="mailto:cranzcanal@gmail.com"
                className="text-violet-400 hover:text-violet-300 transition"
              >
                cranzcanal@gmail.com
              </a>
              . También puedes reclamar ante la Agencia Española de Protección de Datos (AEPD).
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">8. Cookies</h2>
            <p>
              Usamos únicamente cookies técnicas necesarias para la sesión de usuario (cookie{" "}
              <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-xs">
                chatbot_session
              </code>
              ). No usamos cookies de seguimiento ni publicidad.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">9. Cambios en esta política</h2>
            <p>
              Podemos actualizar esta Política. Notificaremos los cambios materiales por email o
              mediante aviso en el Servicio. Te recomendamos revisarla periódicamente.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
