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
    ssUrl.searchParams.set('image_quality', '72');
    ssUrl.searchParams.set('block_ads', 'true');
    ssUrl.searchParams.set('block_cookie_banners', 'true');
    ssUrl.searchParams.set('timeout', '30');
    ssUrl.searchParams.set('delay', '4000');

    const res = await fetch(ssUrl.toString(), { signal: AbortSignal.timeout(40_000) });
    if (!res.ok) {
      const errBody = await res.text().catch(() => '');
      console.error('[screenshot] failed:', res.status, errBody.slice(0, 200));
      return null;
    }
    const buf = await res.arrayBuffer();
    console.log(`[screenshot] ok for ${url}, size=${buf.byteLength}`);
    return Buffer.from(buf).toString('base64');
  } catch (e) {
    console.error('[screenshot] error:', e);
    return null;
  }
}

// Jina AI Reader renders JavaScript pages fully — handles SPAs, Replit sleeping apps, etc.
async function fetchJinaText(url: string): Promise<string> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        'Accept': 'text/plain',
        'X-No-Cache': 'true',
      },
      signal: AbortSignal.timeout(25_000),
    });
    if (!res.ok) {
      console.error('[jina] failed:', res.status);
      return '';
    }
    const text = await res.text();
    console.log(`[jina] ok for ${url}, length=${text.length}`);
    return text.slice(0, 10000);
  } catch (e) {
    console.error('[jina] error:', e);
    return '';
  }
}

export async function analyzeWebsite(url: string): Promise<VisualAnalysis> {
  if (!process.env.SCREENSHOTONE_ACCESS_KEY) return FALLBACK;

  try {
    // Step 1: Light HTML fetch for sub-page link detection
    const subPageLinks: string[] = [];
    try {
      const htmlRes = await fetch(url, {
        headers: { 'User-Agent': BOT_UA },
        signal: AbortSignal.timeout(8_000),
      });
      const html = await htmlRes.text();
      subPageLinks.push(...extractSubPageLinks(html, url));
    } catch { /* ignore — screenshots will still work */ }

    // Step 2: Screenshots + Jina text in parallel (Jina finishes inside the screenshot window)
    const urlsToCapture = [url, ...subPageLinks.slice(0, 2)];
    const [screenshots, jinaText] = await Promise.all([
      Promise.all(urlsToCapture.map(takeScreenshot)),
      fetchJinaText(url),
    ]);
    const validShots = screenshots.filter((s): s is string => s !== null);
    console.log(`[visual] shots=${validShots.length}, jina=${jinaText.length} chars`);

    if (validShots.length === 0 && !jinaText) {
      console.error('[visual] no data from screenshots or jina');
      return FALLBACK;
    }

    // Step 3: Build Claude message with all available data
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
      text: `Analiza la web de un negocio y extrae la información solicitada.
${validShots.length > 0 ? `\nCapturas de pantalla (${validShots.length}):\n${pageLabels}` : ''}
${jinaText ? `\nTEXTO COMPLETO EXTRAÍDO DE LA WEB:\n---\n${jinaText}\n---` : ''}

Devuelve SOLO un objeto JSON válido sin explicación adicional ni markdown:

{
  "primaryColor": "#hex",
  "secondaryColor": "#hex",
  "widgetStyle": "...",
  "businessInfo": "..."
}

INSTRUCCIONES PARA CADA CAMPO:

primaryColor: ${validShots.length > 0 ? 'Analiza VISUALMENTE las imágenes — color principal de marca en botones, header, logo, CTAs. No negro puro ni blanco puro.' : '"#1e293b"'}
secondaryColor: ${validShots.length > 0 ? 'Analiza VISUALMENTE las imágenes — color complementario, diferente tono del primary.' : '"#334155"'}
widgetStyle: ${validShots.length > 0 ? 'Analiza VISUALMENTE las imágenes — elige UNO exacto: bubble (startup/colorida/gradientes) | minimal (blanco/limpio) | rounded (lifestyle/redondeado) | dark (tech/oscura) | neon (gaming/brillante) | corporate (b2b/finanzas) | soft (belleza/salud/pastel) | floating (premium/lujo) | compact (e-commerce/noticias) | retro (vintage/bold)' : '"bubble"'}
businessInfo: ${jinaText ? 'Extrae del TEXTO PROPORCIONADO ARRIBA toda la información del negocio. Incluye LITERALMENTE: nombre del negocio, dirección completa, teléfono/WhatsApp/email, TODOS los servicios con sus precios EXACTOS (copia los números tal como aparecen), horarios por día de la semana, cualquier promoción. Si un dato no aparece en el texto, no lo incluyas. No inventes nada.' : 'Extrae TODO el texto de negocio visible en las imágenes: nombre, dirección, teléfonos, servicios con precios exactos, horarios por día.'}`,
    };

    const content: (Anthropic.ImageBlockParam | Anthropic.TextBlockParam)[] =
      validShots.length > 0 ? [...imageBlocks, textPrompt] : [textPrompt];

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content }],
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
