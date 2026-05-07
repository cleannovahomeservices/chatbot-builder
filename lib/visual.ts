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

// Extracts phone/WhatsApp/email from HTML links — often not visible as text in SPAs
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
  return links.slice(0, 4);
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
    ssUrl.searchParams.set('image_quality', '85');
    ssUrl.searchParams.set('block_ads', 'true');
    ssUrl.searchParams.set('block_cookie_banners', 'true');
    ssUrl.searchParams.set('timeout', '45');
    ssUrl.searchParams.set('delay', '7000');

    const res = await fetch(ssUrl.toString(), { signal: AbortSignal.timeout(65_000) });
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

// Jina AI Reader renders JavaScript pages fully — backup text source for contact data
async function fetchJinaText(url: string): Promise<string> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        'Accept': 'text/plain',
        'X-No-Cache': 'true',
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      console.error('[jina] failed:', res.status);
      return '';
    }
    const text = await res.text();
    console.log(`[jina] ok for ${url}, length=${text.length}`);
    return text.slice(0, 25000);
  } catch (e) {
    console.error('[jina] error:', e);
    return '';
  }
}

export async function analyzeWebsite(url: string): Promise<VisualAnalysis> {
  if (!process.env.SCREENSHOTONE_ACCESS_KEY) return FALLBACK;

  try {
    // Step 1: Light HTML fetch for sub-page links + contact info hidden in href="tel:/mailto:/wa.me"
    const subPageLinks: string[] = [];
    let contactInfo = '';
    try {
      const htmlRes = await fetch(url, {
        headers: { 'User-Agent': BOT_UA },
        signal: AbortSignal.timeout(8_000),
      });
      const html = await htmlRes.text();
      subPageLinks.push(...extractSubPageLinks(html, url));
      contactInfo = extractContactLinks(html);
      if (contactInfo) console.log('[visual] contact links found in HTML:', contactInfo);
    } catch { /* ignore — screenshots will still work */ }

    // Step 2: Screenshots (home + up to 3 subpages) + Jina text in parallel
    const urlsToCapture = [url, ...subPageLinks.slice(0, 3)];
    const [screenshots, jinaText] = await Promise.all([
      Promise.all(urlsToCapture.map(takeScreenshot)),
      fetchJinaText(url),
    ]);
    const validShots = screenshots.filter((s): s is string => s !== null);
    console.log(`[visual] shots=${validShots.length}/${urlsToCapture.length}, jina=${jinaText.length} chars`);

    if (validShots.length === 0 && !jinaText) {
      console.error('[visual] no data from screenshots or jina');
      return FALLBACK;
    }

    // Step 3: Extract contact info from Jina text as safety net
    // (covers CSS pseudo-element phones invisible to screenshot OCR)
    for (const m of jinaText.matchAll(/wa\.me\/(\d+)/gi)) {
      const num = '+' + m[1];
      if (!contactInfo.includes(m[1].slice(-9))) {
        contactInfo = contactInfo ? `${contactInfo}\nWhatsApp: ${num}` : `WhatsApp: ${num}`;
        console.log('[visual] wa.me found in jina:', num);
      }
    }
    for (const m of jinaText.matchAll(/\(tel:([+\d\s\-().]+?)\)/gi)) {
      const num = m[1].trim();
      if (num.length >= 9 && !contactInfo.includes(num.replace(/\D/g, '').slice(-9))) {
        contactInfo = contactInfo ? `${contactInfo}\nTeléfono: ${num}` : `Teléfono: ${num}`;
        console.log('[visual] tel: found in jina:', num);
      }
    }
    const phoneMatches = jinaText.match(/(?:\+?34[\s-]?)?(?:6\d{2}|7[0-9]\d)[\s-]?\d{2}[\s-]?\d{2}[\s-]?\d{2}/g);
    if (phoneMatches) {
      for (const phone of [...new Set(phoneMatches.map(p => p.trim()))]) {
        const digits = phone.replace(/\D/g, '');
        if (!contactInfo.includes(digits.slice(-9))) {
          contactInfo = contactInfo ? `${contactInfo}\nTeléfono: ${phone}` : `Teléfono: ${phone}`;
        }
      }
    }

    // Step 4: Build Claude message — screenshots are the PRIMARY source
    const imageBlocks: Anthropic.ImageBlockParam[] = validShots.map((data) => ({
      type: 'image' as const,
      source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data },
    }));

    const pageLabels = urlsToCapture
      .slice(0, validShots.length)
      .map((u, i) => `Página ${i + 1}: ${u}`)
      .join('\n');

    const contactBlock = contactInfo
      ? `\nCONTACTO DETECTADO (incluye esto EXACTAMENTE en businessInfo, no lo omitas):\n${contactInfo}`
      : '';

    const textPrompt: Anthropic.TextBlockParam = {
      type: 'text',
      text: `Analiza las capturas de pantalla de la web de un negocio y extrae toda la información.

Capturas disponibles (${validShots.length}):
${pageLabels}
${jinaText ? `\nTEXTO ADICIONAL EXTRAÍDO DE LA WEB (usa como apoyo si algo no se ve claro en las imágenes):\n---\n${jinaText.slice(0, 8000)}\n---` : ''}${contactBlock}

Devuelve SOLO un objeto JSON válido sin explicación adicional ni markdown:

{
  "primaryColor": "#hex",
  "secondaryColor": "#hex",
  "widgetStyle": "...",
  "businessInfo": "..."
}

INSTRUCCIONES:

primaryColor: Mira las imágenes — ¿qué color de marca aparece en el header, botones principales, logo o CTAs? Ese es el primaryColor. Devuelve el hex exacto. Evita negro puro (#000000) o blanco puro (#ffffff).

secondaryColor: Color complementario visible en la web — diferente tono o matiz del primario. Si no hay un segundo color claro, oscurece el primario 20 puntos.

widgetStyle: Elige UNO basándote en el estilo visual de las imágenes:
  bubble — startup moderna, gradientes, colores vivos (opción por defecto)
  minimal — diseño muy limpio, mucho espacio en blanco, tipografía fina
  rounded — lifestyle, bienestar, bordes redondeados, acogedor
  dark — SOLO si la web entera es oscura: tech, gaming, agencia digital nocturna. NO para bares, barberías, tiendas físicas
  neon — SOLO si hay colores neón reales y gaming
  corporate — empresa B2B, finanzas, consultoría, aspecto serio y formal
  soft — belleza, spa, salud, colores pastel
  floating — lujo, moda, premium, mucho espacio
  compact — e-commerce, muchos productos/artículos
  retro — vintage, tipografía bold, nostálgico
  IMPORTANTE: si el screenshot parece pantalla de carga negra, elige bubble.

businessInfo: Extrae TODA la información del negocio visible en las imágenes y el texto. Incluye sin omitir nada:
  - Nombre exacto del negocio
  - Dirección completa (calle, número, ciudad, barrio)
  - Teléfono, WhatsApp y/o email (busca en imágenes Y en el contactBlock de arriba)
  - TODOS los servicios con sus precios EXACTOS tal como aparecen
  - Horarios de apertura por día de la semana
  - Promociones o descuentos actuales
  - Cualquier otro dato relevante para el cliente
  Si un dato no aparece, simplemente no lo incluyas — nunca inventes información.`,
    };

    const content: (Anthropic.ImageBlockParam | Anthropic.TextBlockParam)[] =
      validShots.length > 0 ? [...imageBlocks, textPrompt] : [textPrompt];

    const msg = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4000,
      messages: [{ role: 'user', content }],
    });

    const raw = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) { console.error('[visual] no JSON in response:', raw.slice(0, 200)); return FALLBACK; }

    const parsed = JSON.parse(match[0]) as Partial<VisualAnalysis>;
    const validStyles: WidgetStyle[] = ['bubble','minimal','rounded','dark','neon','corporate','soft','floating','compact','retro'];

    let businessInfo = typeof parsed.businessInfo === 'string' ? parsed.businessInfo : '';

    // Hard-inject any contact data Claude missed (phone/wa.me via CSS pseudo-elements are invisible to OCR)
    if (contactInfo) {
      for (const line of contactInfo.split('\n').filter(Boolean)) {
        const value = line.slice(line.indexOf(': ') + 2);
        const digits = value.replace(/\D/g, '');
        const alreadyPresent = digits.length >= 8
          ? businessInfo.replace(/\D/g, '').includes(digits.slice(-8))
          : businessInfo.toLowerCase().includes(value.toLowerCase().slice(0, 12));
        if (!alreadyPresent) {
          businessInfo = businessInfo ? `${businessInfo}\n${line}` : line;
          console.log('[visual] hard-injected missing contact:', line);
        }
      }
    }

    return {
      primaryColor: /^#[0-9a-fA-F]{6}$/.test(parsed.primaryColor ?? '') ? parsed.primaryColor! : FALLBACK.primaryColor,
      secondaryColor: /^#[0-9a-fA-F]{6}$/.test(parsed.secondaryColor ?? '') ? parsed.secondaryColor! : FALLBACK.secondaryColor,
      widgetStyle: validStyles.includes(parsed.widgetStyle as WidgetStyle) ? parsed.widgetStyle as WidgetStyle : FALLBACK.widgetStyle,
      businessInfo,
    };
  } catch (e) {
    console.error('[visual] analysis error:', e);
    return FALLBACK;
  }
}
