// Genera el snippet de instalación y el .md descargable del widget.
// Único sitio donde se construye (antes estaba duplicado en chatbot-card.tsx y wizard.tsx).

export interface WidgetSnippetConfig {
  chatbotId: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  style: string;
  icon: string;
  greeting: string;
  avatarUrl?: string | null;
  hideBranding?: boolean;
  handoffWhatsapp?: string | null;
  handoffEmail?: string | null;
  bookingUrl?: string | null;
}

const clean = (s: string) => (s || '').replace(/[`"\\]/g, '');

export function buildWidgetConfigObject(c: WidgetSnippetConfig): string {
  const parts: string[] = [
    `chatbotId:"${c.chatbotId}"`,
    `name:"${clean(c.name)}"`,
    `primaryColor:"${c.primaryColor}"`,
    `secondaryColor:"${c.secondaryColor}"`,
    `style:"${c.style}"`,
    `icon:"${c.icon}"`,
    `greeting:"${clean(c.greeting)}"`,
  ];
  if (c.avatarUrl) parts.push(`avatarUrl:"${clean(c.avatarUrl)}"`);
  if (c.hideBranding) parts.push(`hideBranding:true`);
  if (c.handoffWhatsapp) parts.push(`handoffWhatsapp:"${clean(c.handoffWhatsapp)}"`);
  if (c.handoffEmail) parts.push(`handoffEmail:"${clean(c.handoffEmail)}"`);
  if (c.bookingUrl) parts.push(`bookingUrl:"${clean(c.bookingUrl)}"`);
  return `{${parts.join(',')}}`;
}

export function buildSnippet(c: WidgetSnippetConfig, appUrl: string): string {
  return `<!-- Chatbot: ${clean(c.name)} -->\n<script>window.ChatbotConfig=${buildWidgetConfigObject(c)};</script>\n<script src="${appUrl}/widget.js" async defer></script>`;
}

// Alternativa por iframe: chat embebido "inline" (una caja dentro de la página),
// para constructores tipo Wix/Squarespace donde solo se permite un bloque HTML y no
// scripts en el <body>. No es un overlay flotante (eso bloquearía la esquina), sino
// una caja que el cliente coloca donde quiera.
export function buildIframeSnippet(c: WidgetSnippetConfig, appUrl: string): string {
  const src = `${appUrl}/embed/${c.chatbotId}`;
  return `<!-- Chatbot: ${clean(c.name)} (iframe) -->\n<iframe src="${src}" title="${clean(c.name)}" loading="lazy" style="border:0;width:100%;max-width:420px;height:640px;border-radius:16px" allow="clipboard-write"></iframe>`;
}

export function buildMarkdown(c: WidgetSnippetConfig, appUrl: string): string {
  const snippet = buildSnippet(c, appUrl);
  const host = new URL(appUrl).hostname;
  return `# Chatbot: ${c.name}

Eres un asistente de IA. Tu tarea es integrar el siguiente widget de chatbot en este proyecto web. No necesitas hacer nada más que añadir el código de abajo en el lugar indicado.

## Instrucciones de integración

Añade las siguientes líneas de código justo antes del cierre \`</body>\` del archivo HTML principal:

- **Next.js** → en \`app/layout.tsx\` antes de \`{children}\`, o en \`pages/_document.tsx\` dentro de \`<Head>\`
- **Astro / SvelteKit / Nuxt** → en el layout raíz
- **HTML estático** → antes de \`</body>\` en todos los archivos HTML

## Código

\`\`\`html
${snippet}
\`\`\`

## Notas

- El chatbot funciona automáticamente tras la integración. No requiere ninguna configuración adicional.
- Si el proyecto tiene Content Security Policy (CSP): añade \`${host}\` a \`script-src\` y \`connect-src\`.
- Los cambios de contenido son inmediatos y no requieren re-integrar este archivo.
- Para actualizar colores o estilo: descarga un nuevo archivo desde ${appUrl}/dashboard.
`;
}
