import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type WidgetStyle =
  | 'bubble' | 'minimal' | 'rounded' | 'dark'
  | 'neon' | 'corporate' | 'soft' | 'floating'
  | 'compact' | 'retro';

export interface VisualAnalysis {
  primaryColor: string;
  secondaryColor: string;
  widgetStyle: WidgetStyle;
  businessInfo: string;
}

const FALLBACK: VisualAnalysis = {
  primaryColor: '#1e293b',
  secondaryColor: '#334155',
  widgetStyle: 'bubble',
  businessInfo: '',
};

const BOT_UA = 'Mozilla/5.0 (compatible; ChatbotBuilder/1.0)';

function extractSubPageLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const keywords = [
    'precio', 'tarifa', 'servicio', 'menu', 'carta', 'catalogo', 'producto',
    'contacto', 'horario', 'tratamiento', 'reserva', 'cita', 'nosotros', 'oferta',
    'service', 'pricing', 'price', 'product', 'contact', 'about', 'hours',
  ];
  const seen = new Set<string>();
  const links: string[] = [];
  for (const m of html.matchAll(/href="([^"#][^"]*?)"/gi)) {
    try {
      const url = new URL(m[1], baseUrl);
      if (url.hostname !== base.hostname) continue;
      url.hash = '';
      url.search = '';
      const href = url.href;
      if (href === baseUrl || seen.has(href)) continue;
      const path = href.toLowerCase();
      if (keywords.some(k => path.includes(k))) {
        seen.add(href);
        links.push(href);
      }
    } catch { /* skip */ }
  }
  return links.slice(0, 2);
}

async function takeScreenshot(url: string): Promise<string | null> {
  const accessKey = process.env.SCREENSHOTONE_ACCESS_KEY;
  if (!accessKey) return null;
  try {
    const ssUrl = new URL('https://api.screenshotone.com/take');
    ssUrl.searchParams.set('access_key', accessKey);
    ssUrl.searchParams.set('url', url);
    ssUrl.searchParams.set('format', 'jpg');
    ssUrl.searchParams.set('viewport_width', '1280');
    ssUrl.searchParams.set('viewport_height', '900');
    ssUrl.searchParams.set('full_page', 'true');
    ssUrl.searchParams.set('full_page_max_height', '4000');
    ssUrl.searchParams.set('image_quality', '72');
    ssUrl.searchParams.set('block_ads', 'true');
    ssUrl.searchParams.set('block_cookie_banners', 'true');
    ssUrl.searchParams.set('timeout', '20');
    ssUrl.searchParams.set('delay', '1500');

    const res = await fetch(ssUrl.toString(), { signal: AbortSignal.timeout(25_000) });
    if (!res.ok) { console.error('[screenshot] failed:', res.status); return null; }
    const buf = await res.arrayBuffer();
    return Buffer.from(buf).toString('base64');
  } catch (e) {
    console.error('[screenshot] error:', e);
    return null;
  }
}

export async function analyzeWebsite(url: string): Promise<VisualAnalysis> {
  if (!process.env.SCREENSHOTONE_ACCESS_KEY) return FALLBACK;

  try {
    // Fetch lightweight HTML just for sub-page link detection (no JS rendering needed)
    const subPageLinks: string[] = [];
    try {
      const htmlRes = await fetch(url, {
        headers: { 'User-Agent': BOT_UA },
        signal: AbortSignal.timeout(8_000),
      });
      const html = await htmlRes.text();
      subPageLinks.push(...extractSubPageLinks(html, url));
    } catch { /* ignore — screenshots will still work */ }

    // Take screenshots in parallel: homepage (full page) + up to 2 sub-pages
    const urlsToCapture = [url, ...subPageLinks.slice(0, 2)];
    const screenshots = await Promise.all(urlsToCapture.map(takeScreenshot));
    const validShots = screenshots.filter((s): s is string => s !== null);

    if (validShots.length === 0) {
      console.error('[visual] no screenshots captured');
      return FALLBACK;
    }

    // Build message content: all screenshots + extraction prompt
    const imageBlocks: Anthropic.ImageBlockParam[] = validShots.map((data) => ({
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data },
    }));

    const pageLabels = urlsToCapture
      .slice(0, validShots.length)
      .map((u, i) => `Página ${i + 1}: ${u}`)
      .join('\n');

    const textPrompt: Anthropic.TextBlockParam = {
      type: 'text',
      text: `Analiza estas capturas de pantalla de una web de negocio (${validShots.length} página${validShots.length > 1 ? 's' : ''}).
${pageLabels}

Devuelve SOLO un objeto JSON válido sin explicación adicional ni markdown:

{
  "primaryColor": "#hex",
  "secondaryColor": "#hex",
  "widgetStyle": "...",
  "businessInfo": "..."
}

INSTRUCCIONES PARA CADA CAMPO:

primaryColor: Color principal de la marca. Busca en botones, header, logo, CTAs. No negro puro ni blanco puro.
secondaryColor: Color complementario, diferente tono del primary (no solo más oscuro del mismo).
widgetStyle: Elige UNO exacto: bubble (colorida/startup/gradientes) | minimal (blanco/limpio) | rounded (lifestyle/redondeado) | dark (oscura/tech) | neon (gaming/artística/brillante) | corporate (empresa/b2b/finanzas) | soft (belleza/salud/pastel) | floating (premium/lujo) | compact (e-commerce/noticias) | retro (vintage/bold)
businessInfo: Extrae TODO el texto de negocio visible en las imágenes. Incluye LITERALMENTE:
  - Nombre del negocio
  - Dirección completa
  - Teléfono, WhatsApp, email
  - TODOS los servicios con sus precios EXACTOS (copia los números tal como aparecen)
  - Horarios por día de la semana
  - Cualquier promoción o descuento
  Si un dato no aparece en las imágenes, no lo incluyas. No inventes nada.`,
    };

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: [...imageBlocks, textPrompt] }],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) { console.error('[visual] no JSON in response:', raw.slice(0, 200)); return FALLBACK; }

    const parsed = JSON.parse(match[0]) as Partial<VisualAnalysis>;
    const validStyles: WidgetStyle[] = ['bubble','minimal','rounded','dark','neon','corporate','soft','floating','compact','retro'];

    return {
      primaryColor: /^#[0-9a-fA-F]{6}$/.test(parsed.primaryColor ?? '') ? parsed.primaryColor! : FALLBACK.primaryColor,
      secondaryColor: /^#[0-9a-fA-F]{6}$/.test(parsed.secondaryColor ?? '') ? parsed.secondaryColor! : FALLBACK.secondaryColor,
      widgetStyle: validStyles.includes(parsed.widgetStyle as WidgetStyle) ? parsed.widgetStyle as WidgetStyle : FALLBACK.widgetStyle,
      businessInfo: typeof parsed.businessInfo === 'string' ? parsed.businessInfo : '',
    };
  } catch (e) {
    console.error('[visual] analysis error:', e);
    return FALLBACK;
  }
}
