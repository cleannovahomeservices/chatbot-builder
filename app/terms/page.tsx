import Link from "next/link";

export const metadata = {
  title: "Términos de Servicio — BotLuma",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#0A0A0A] px-4 py-16 text-white">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="mb-10 inline-flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition"
        >
          ← Volver
        </Link>

        <h1 className="mb-2 text-3xl font-bold">Términos de Servicio</h1>
        <p className="mb-10 text-sm text-white/40">Última actualización: junio 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-white/70">
          <section>
            <h2 className="mb-3 text-base font-semibold text-white">1. Aceptación</h2>
            <p>
              Al acceder o usar BotLuma ("el Servicio") aceptas estos Términos. Si no los aceptas,
              no uses el Servicio. BotLuma es operado por su titular ("nosotros").
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">2. Descripción del Servicio</h2>
            <p>
              BotLuma permite crear e integrar chatbots con inteligencia artificial en sitios web.
              El Servicio incluye generación automática de chatbots, panel de gestión e integración
              con repositorios de código.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">3. Cuentas de usuario</h2>
            <p>
              Para usar el Servicio debes crear una cuenta. Eres responsable de mantener la
              seguridad de tus credenciales y de toda actividad bajo tu cuenta. Notifícanos
              inmediatamente cualquier uso no autorizado.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">4. Uso aceptable</h2>
            <p className="mb-2">Aceptas no usar el Servicio para:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Enviar contenido ilegal, fraudulento, difamatorio u obsceno.</li>
              <li>Infringir derechos de propiedad intelectual de terceros.</li>
              <li>Distribuir spam, malware o código malicioso.</li>
              <li>Intentar acceder sin autorización a sistemas o datos ajenos.</li>
              <li>Revender o sublicenciar el Servicio sin autorización previa por escrito.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">5. Planes y pagos</h2>
            <p>
              BotLuma ofrece un plan gratuito con funcionalidades limitadas y planes de pago con
              acceso ampliado. Los precios se muestran en el Servicio. Los cargos son en euros (€)
              y se facturan de forma recurrente según el ciclo elegido. No se realizan reembolsos
              por períodos parciales salvo exigencia legal.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">6. Propiedad intelectual</h2>
            <p>
              El Servicio, su diseño, código y contenido son propiedad de BotLuma o sus
              licenciantes. Los chatbots que crees y el contenido que subas siguen siendo tuyos.
              Nos concedes una licencia limitada para operar y mostrar ese contenido únicamente
              con el fin de prestar el Servicio.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">7. Limitación de responsabilidad</h2>
            <p>
              El Servicio se proporciona "tal cual". No garantizamos disponibilidad ininterrumpida
              ni que el Servicio esté libre de errores. En la máxima medida permitida por la ley,
              nuestra responsabilidad total no superará el importe pagado en los últimos 12 meses.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">8. Terminación</h2>
            <p>
              Podemos suspender o cancelar tu cuenta si incumples estos Términos. Puedes cancelar
              tu cuenta en cualquier momento desde tu panel de usuario. Tras la cancelación, tus
              datos se eliminarán conforme a nuestra Política de Privacidad.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">9. Cambios en los Términos</h2>
            <p>
              Podemos modificar estos Términos en cualquier momento. Te notificaremos los cambios
              materiales por email o mediante aviso en el Servicio. El uso continuado del Servicio
              tras la notificación implica la aceptación de los nuevos Términos.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-base font-semibold text-white">10. Contacto</h2>
            <p>
              Para cualquier consulta sobre estos Términos escríbenos a{" "}
              <a
                href="mailto:cranzcanal@gmail.com"
                className="text-violet-400 hover:text-violet-300 transition"
              >
                cranzcanal@gmail.com
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
