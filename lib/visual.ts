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

// ─── Screenshot helpers ────────────────────────────────────────────────────

// Fast screenshot — no delay, viewport only. For color detection.
// The brand colors are in the header/logo/buttons which load immediately.
async function takeColorScreenshot(url: string): Promise<string | null> {
  const accessKey = process.env.SCREENSHOTONE_ACCESS_KEY;
  if (!accessKey) return null;
  try {
    const ssUrl = `https://api.screenshotone.com/take?access_key=${accessKey}&url=${encodeURIComponent(url)}&format=jpg&viewport_width=1280&viewport_height=900&full_page=false&image_quality=75&block_ads=true&block_cookie_banners=true&timeout=15`;
    const res = await fetch(ssUrl, { signal: AbortSignal.timeout(18_000) });
    if (!res.ok) { console.error('[screenshot-color] failed:', res.status); return null; }
    const buf = await res.arrayBuffer();
    console.log(`[screenshot-color] ok, size=${buf.byteLength}`);
    return Buffer.from(buf).toString('base64');
  } catch (e) {
    console.error('[screenshot-color] error:', e);
    return null;
  }
}

// Slow screenshot — 7s delay, full page. For content extraction.
async function takeContentScreenshot(url: string): Promise<string | null> {
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
    ssUrl.searchParams.set('image_quality', '85');
    ssUrl.searchParams.set('block_ads', 'true');
    ssUrl.searchParams.set('block_cookie_banners', 'true');
    ssUrl.searchParams.set('timeout', '45');
    ssUrl.searchParams.set('delay', '7000');
    const res = await fetch(ssUrl.toString(), { signal: AbortSignal.timeout(65_000) });
    if (!res.ok) { console.error('[screenshot-content] failed:', res.status); return null; }
    const buf = await res.arrayBuffer();
    console.log(`[screenshot-content] ok for ${url}, size=${buf.byteLength}`);
    return Buffer.from(buf).toString('base64');
  } catch (e) {
    console.error('[screenshot-content] error:', e);
    return null;
  }
}

// ─── Contact extraction ───────────────────────────────────────────────────

function extractContactLinks(html: string): string {
  const phones = new Set<string>();
  const whatsapps = new Set<string>();
  const emails = new Set<string>();
  for (const m of html.matchAll(/href="tel:([^"]+)"/gi))
    phones.add(decodeURIComponent(m[1].trim()));
  for (const m of html.matchAll(/href="https?:\/\/wa\.me\/(\d+)/gi))
    whatsapps.add('+' + m[1]);
  for (const m of html.matchAll(/href="mailto:([^"?#]+)"/gi))
    emails.add(m[1].trim());
  const parts: string[] = [];
  if (phones.size) parts.push('Teléfono: ' + [...phones].join(', '));
  if (whatsapps.size) parts.push('WhatsApp: ' + [...whatsapps].join(', '));
  if (emails.size) parts.push('Email: ' + [...emails].join(', '));
  return parts.join('\n');
}

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
      url.hash = ''; url.search = '';
      const href = url.href;
      if (href === baseUrl || seen.has(href)) continue;
      if (keywords.some(k => href.toLowerCase().includes(k))) { seen.add(href); links.push(href); }
    } catch { /* skip */ }
  }
  return links.slice(0, 4);
}

// ─── Text extraction (Jina) ───────────────────────────────────────────────

async function fetchJinaText(url: string): Promise<string> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'Accept': 'text/plain', 'X-No-Cache': 'true' },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) { console.error('[jina] failed:', res.status); return ''; }
    const text = await res.text();
    console.log(`[jina] ok, length=${text.length}`);
    return text.slice(0, 25000);
  } catch (e) {
    console.error('[jina] error:', e);
    return '';
  }
}

// ─── Claude calls ─────────────────────────────────────────────────────────

// Original simple color analysis — Claude Haiku, 256 tokens, focused prompt
async function detectColors(screenshot: string): Promise<{ primaryColor: string; secondaryColor: string; widgetStyle: WidgetStyle }> {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: screenshot } },
        {
          type: 'text',
          text: `Analiza esta captura de pantalla de una web de negocio.
Devuelve SOLO un objeto JSON válido, sin explicación:

{"primaryColor":"#hex","secondaryColor":"#hex","widgetStyle":"..."}

Para primaryColor y secondaryColor:
- Busca los colores reales de la marca en botones, header, logo, CTAs.
- primaryColor: color dominante de marca (no negro puro, no blanco puro).
- secondaryColor: un color DIFERENTE que complemente al primary (contraste visible).
- Si la web es oscura, el primary puede ser el acento de color.

Para widgetStyle elige UNO de estos valores exactos:
- bubble: web colorida/startup/tech con gradientes
- minimal: minimalista, mucho blanco, limpio
- rounded: lifestyle/wellness/amigable, formas redondeadas
- dark: web oscura/gaming/crypto/tech premium
- neon: creativa/artística/gaming, colores brillantes
- corporate: empresarial/b2b/finanzas/servicios profesionales
- soft: belleza/salud/infantil/colores pastel
- floating: premium/lujo/portfolio
- compact: noticias/e-commerce/mucho contenido
- retro: vintage/artístico/diseño gráfico bold`,
        },
      ],
    }],
  });
  const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { primaryColor: FALLBACK.primaryColor, secondaryColor: FALLBACK.secondaryColor, widgetStyle: FALLBACK.widgetStyle };
  const parsed = JSON.parse(match[0]) as Partial<VisualAnalysis>;
  const validStyles: WidgetStyle[] = ['bubble','minimal','rounded','dark','neon','corporate','soft','floating','compact','retro'];
  return {
    primaryColor: /^#[0-9a-fA-F]{6}$/.test(parsed.primaryColor ?? '') ? parsed.primaryColor! : FALLBACK.primaryColor,
    secondaryColor: /^#[0-9a-fA-F]{6}$/.test(parsed.secondaryColor ?? '') ? parsed.secondaryColor! : FALLBACK.secondaryColor,
    widgetStyle: validStyles.includes(parsed.widgetStyle as WidgetStyle) ? parsed.widgetStyle as WidgetStyle : FALLBACK.widgetStyle,
  };
}

// Content extraction — Claude Sonnet, 4000 tokens, businessInfo only
async function extractBusinessInfo(
  screenshots: string[],
  jinaText: string,
  contactInfo: string,
  pageLabels: string,
): Promise<string> {
  const imageBlocks: Anthropic.ImageBlockParam[] = screenshots.map((data) => ({
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data },
  }));

  const contactBlock = contactInfo
    ? `\nCONTACTO DETECTADO — incluye esto exactamente:\n${contactInfo}`
    : '';

  const textBlock: Anthropic.TextBlockParam = {
    type: 'text',
    text: `Eres un extractor de información de negocios. Analiza las capturas de pantalla${jinaText ? ' y el texto extraído' : ''} de esta web y devuelve SOLO un JSON con businessInfo.

Capturas (${screenshots.length}):
${pageLabels}
${jinaText ? `\nTEXTO WEB:\n---\n${jinaText.slice(0, 12000)}\n---` : ''}${contactBlock}

Devuelve SOLO este JSON sin markdown:
{"businessInfo":"..."}

businessInfo debe incluir TODO lo que encuentres:
- Nombre exacto del negocio
- Dirección completa
- Teléfono/WhatsApp/email (busca en imágenes, texto y contactBlock)
- Todos los servicios con precios EXACTOS
- Horarios por día de la semana
- Promociones vigentes
No inventes nada. No omitas nada que esté en las fuentes.`,
  };

  const content: (Anthropic.ImageBlockParam | Anthropic.TextBlockParam)[] =
    screenshots.length > 0 ? [...imageBlocks, textBlock] : [textBlock];

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    messages: [{ role: 'user', content }],
  });

  const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return '';
  try {
    const parsed = JSON.parse(match[0]) as { businessInfo?: string };
    return typeof parsed.businessInfo === 'string' ? parsed.businessInfo : '';
  } catch { return ''; }
}

// ─── Main export ─────────────────────────────────────────────────────────

export async function analyzeWebsite(url: string): Promise<VisualAnalysis> {
  if (!process.env.SCREENSHOTONE_ACCESS_KEY) return FALLBACK;

  try {
    // Phase 1 — all parallel: color screenshot (fast) + HTML fetch + Jina text
    const [colorShot, htmlResult, jinaText] = await Promise.all([
      takeColorScreenshot(url),
      (async () => {
        try {
          const res = await fetch(url, { headers: { 'User-Agent': BOT_UA }, signal: AbortSignal.timeout(8_000) });
          const html = await res.text();
          return { links: extractSubPageLinks(html, url), contact: extractContactLinks(html) };
        } catch { return { links: [] as string[], contact: '' }; }
      })(),
      fetchJinaText(url),
    ]);

    // Build contact info from HTML hrefs + Jina markdown
    let contactInfo = htmlResult.contact;
    for (const m of jinaText.matchAll(/wa\.me\/(\d+)/gi)) {
      const num = '+' + m[1];
      if (!contactInfo.includes(m[1].slice(-9))) {
        contactInfo = contactInfo ? `${contactInfo}\nWhatsApp: ${num}` : `WhatsApp: ${num}`;
        console.log('[visual] wa.me in jina:', num);
      }
    }
    for (const m of jinaText.matchAll(/\(tel:([+\d\s\-().]+?)\)/gi)) {
      const num = m[1].trim();
      if (num.length >= 9 && !contactInfo.includes(num.replace(/\D/g, '').slice(-9))) {
        contactInfo = contactInfo ? `${contactInfo}\nTeléfono: ${num}` : `Teléfono: ${num}`;
      }
    }
    const phoneMatches = jinaText.match(/(?:\+?34[\s-]?)?(?:6\d{2}|7[0-9]\d)[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}/g);
    if (phoneMatches) {
      for (const phone of [...new Set(phoneMatches.map(p => p.trim()))]) {
        if (!contactInfo.includes(phone.replace(/\D/g, '').slice(-9))) {
          contactInfo = contactInfo ? `${contactInfo}\nTeléfono: ${phone}` : `Teléfono: ${phone}`;
        }
      }
    }
    if (contactInfo) console.log('[visual] contactInfo:', contactInfo);

    // Phase 2 — content screenshots for subpages (in parallel with Phase 1 already done)
    const contentUrls = [url, ...htmlResult.links.slice(0, 3)];
    const contentShots = await Promise.all(contentUrls.map(takeContentScreenshot));
    const validContentShots = contentShots.filter((s): s is string => s !== null);
    const pageLabels = contentUrls.slice(0, validContentShots.length).map((u, i) => `Página ${i + 1}: ${u}`).join('\n');

    console.log(`[visual] colorShot=${colorShot ? 'ok' : 'null'}, contentShots=${validContentShots.length}, jina=${jinaText.length}`);

    if (!colorShot && validContentShots.length === 0 && !jinaText) return FALLBACK;

    // Phase 3 — two Claude calls in parallel: Haiku for colors, Sonnet for content
    const screenshotsForContent = validContentShots.length > 0 ? validContentShots : (colorShot ? [colorShot] : []);
    const [colors, rawBusinessInfo] = await Promise.all([
      colorShot
        ? detectColors(colorShot)
        : Promise.resolve({ primaryColor: FALLBACK.primaryColor, secondaryColor: FALLBACK.secondaryColor, widgetStyle: FALLBACK.widgetStyle }),
      (screenshotsForContent.length > 0 || jinaText)
        ? extractBusinessInfo(screenshotsForContent, jinaText, contactInfo, pageLabels)
        : Promise.resolve(''),
    ]);

    // Hard-inject any contact data Claude missed
    let businessInfo = rawBusinessInfo;
    if (contactInfo) {
      for (const line of contactInfo.split('\n').filter(Boolean)) {
        const value = line.slice(line.indexOf(': ') + 2);
        const digits = value.replace(/\D/g, '');
        const alreadyIn = digits.length >= 8
          ? businessInfo.replace(/\D/g, '').includes(digits.slice(-8))
          : businessInfo.toLowerCase().includes(value.toLowerCase().slice(0, 12));
        if (!alreadyIn) {
          businessInfo = businessInfo ? `${businessInfo}\n${line}` : line;
          console.log('[visual] hard-injected:', line);
        }
      }
    }

    return { ...colors, businessInfo };
  } catch (e) {
    console.error('[visual] analysis error:', e);
    return FALLBACK;
  }
}
