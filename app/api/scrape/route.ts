import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { analyzeWebsite } from '@/lib/visual';

export const maxDuration = 120;

const BOT_UA = 'Mozilla/5.0 (compatible; ChatbotBuilder/1.0; +https://chatbot-builder-iota.vercel.app)';

function isNeutral(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  const lum = (max + min) / 510;
  return sat < 0.18 || lum < 0.06 || lum > 0.94;
}

function darken(hex: string, amount = 40): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

// ─── Apify: renders JavaScript SPAs with Playwright, extracts clean text ─────

async function scrapeWithApify(url: string): Promise<string | null> {
  const token = process.env.APIFY_API_KEY;
  if (!token) return null;
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~website-content-crawler/run-sync-get-dataset-items?token=${token}&timeout=55&memory=1024`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url }],
          maxCrawlPages: 4,
          maxCrawlDepth: 1,
          crawlerType: 'playwright:adaptive',
        }),
        signal: AbortSignal.timeout(70_000),
      }
    );
    if (!res.ok) { console.error('[apify] failed:', res.status); return null; }
    const items = await res.json() as Array<{ text?: string; url?: string }>;
    if (!Array.isArray(items) || items.length === 0) { console.error('[apify] empty result'); return null; }
    const text = items
      .map(i => i.url && i.url !== url ? `\n\n[${i.url}]\n${(i.text ?? '').slice(0, 5000)}` : (i.text ?? '').slice(0, 10000))
      .join('\n\n')
      .slice(0, 25000);
    console.log(`[apify] ok, ${items.length} pages, ${text.length} chars`);
    return text;
  } catch (e) {
    console.error('[apify] error:', e);
    return null;
  }
}

// ─── Contact extraction from HTML hrefs (wa.me, tel:, mailto:) ──────────────

function extractContactFromHtml(html: string): string {
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

// ─── CSS color extraction (fallback for screenshot) ──────────────────────────

function extractColors(html: string): { primary: string; secondary: string } | null {
  const priority: string[] = [];
  const fallback: string[] = [];
  for (const m of html.matchAll(/<meta[^>]+>/gi)) {
    const tag = m[0];
    if (/theme-color|msapplication-tilecolor/i.test(tag)) {
      const c = tag.match(/content="(#[0-9a-fA-F]{6})"/i);
      if (c) priority.push(c[1].toLowerCase());
    }
  }
  const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');
  const varPattern = /--(?:primary|brand|accent|main|color|theme|highlight)(?:[-\w]*)?:\s*(#[0-9a-fA-F]{6})/gi;
  for (const m of styleBlocks.matchAll(varPattern)) priority.push(m[1].toLowerCase());
  const btnPattern = /(?:\.btn|\.button|button)[^{]*\{[^}]*background(?:-color)?:\s*(#[0-9a-fA-F]{6})/gi;
  for (const m of styleBlocks.matchAll(btnPattern)) priority.push(m[1].toLowerCase());
  for (const m of html.slice(0, 6000).matchAll(/fill="(#[0-9a-fA-F]{6})"/gi)) priority.push(m[1].toLowerCase());
  for (const m of styleBlocks.matchAll(/#([0-9a-fA-F]{6})\b/gi)) fallback.push('#' + m[1].toLowerCase());
  for (const m of html.matchAll(/style="[^"]*(?:background|color)(?:-color)?:\s*(#[0-9a-fA-F]{6})/gi)) fallback.push(m[1].toLowerCase());
  const freq: Record<string, number> = {};
  for (const c of fallback) freq[c] = (freq[c] || 0) + 1;
  const byFreq = Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([c]) => c);
  const candidates = [...priority, ...byFreq].filter(c => !isNeutral(c));
  if (candidates.length === 0) return null;
  const primary = candidates[0];
  const secondary = candidates.find(c => c !== primary) ?? darken(primary);
  return { primary, secondary };
}

function mostSaturated(hexList: string[]): string | null {
  let best: { hex: string; sat: number } | null = null;
  for (const hex of hexList) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const lum = (max + min) / 510;
    if (lum < 0.04 || lum > 0.96) continue;
    const sat = max === 0 ? 0 : (max - min) / max;
    if (!best || sat > best.sat) best = { hex, sat };
  }
  return best && best.sat > 0.04 ? best.hex : null;
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1))).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function extractHslCssVarColors(cssText: string): { primary: string; secondary: string } | null {
  const rootMatch = cssText.match(/:root\s*\{([^}]+)\}/);
  if (!rootMatch) return null;
  const root = rootMatch[1];
  const getVar = (name: string): string | null => {
    const m = root.match(new RegExp(`--${name}:\\s*(\\d+\\.?\\d*)\\s+(\\d+\\.?\\d*)%\\s+(\\d+\\.?\\d*)%`));
    if (!m) return null;
    const hex = hslToHex(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
    return isNeutral(hex) ? null : hex;
  };
  const primary = getVar('primary');
  if (!primary) return null;
  const secondary = getVar('secondary') || getVar('accent') || darken(primary, 20);
  return { primary, secondary: secondary && !isNeutral(secondary) ? secondary : darken(primary, 20) };
}

async function extractColorsFromStylesheets(url: string): Promise<{ primary: string; secondary: string } | null> {
  try {
    const htmlRes = await fetch(url, { headers: { 'User-Agent': BOT_UA }, signal: AbortSignal.timeout(6_000) });
    if (!htmlRes.ok) return null;
    const html = await htmlRes.text();
    const direct = extractColors(html);
    if (direct) return direct;
    const cssUrls: string[] = [];
    for (const m of html.matchAll(/<link[^>]+href="([^"]+\.css[^"]*)"[^>]*/gi)) {
      try { cssUrls.push(new URL(m[1], url).href); } catch { /* skip */ }
    }
    if (cssUrls.length === 0) {
      const allHex = [...html.matchAll(/#([0-9a-fA-F]{6})\b/g)].map(m => '#' + m[1].toLowerCase());
      const p = mostSaturated([...new Set(allHex)]);
      return p ? { primary: p, secondary: darken(p) } : null;
    }
    let cssText = '';
    for (const cssUrl of cssUrls.slice(0, 2)) {
      try {
        const r = await fetch(cssUrl, { headers: { 'User-Agent': BOT_UA }, signal: AbortSignal.timeout(5_000) });
        if (r.ok) cssText += (await r.text()).slice(0, 120000);
        if (cssText.length > 120000) break;
      } catch { /* skip */ }
    }
    if (!cssText) return null;
    const hslColors = extractHslCssVarColors(cssText);
    if (hslColors) { console.log('[css-colors] HSL vars:', hslColors.primary); return hslColors; }
    const fakeHtml = `<html><head><style>${cssText}</style></head><body></body></html>`;
    const fromCss = extractColors(fakeHtml);
    if (fromCss) return fromCss;
    const allHex = [...cssText.matchAll(/#([0-9a-fA-F]{6})\b/g)].map(m => '#' + m[1].toLowerCase());
    const p = mostSaturated([...new Set(allHex)]);
    return p ? { primary: p, secondary: darken(p) } : null;
  } catch { return null; }
}

// ─── HTML text extraction (last-resort fallback) ─────────────────────────────

function extractText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<h[1-3][^>]*>/gi, '\n\n## ').replace(/<h[4-6][^>]*>/gi, '\n\n### ').replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ').replace(/<\/li>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<\/div>/gi, '\n').replace(/<\/tr>/gi, '\n')
    .replace(/<t[dh][^>]*>/gi, ' | ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&euro;/g, '€').replace(/&#8364;/g, '€').replace(/&apos;/g, "'").replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ').replace(/\n +/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function extractInternalLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const keywords = ['precio','tarifa','servicio','menu','carta','catalogo','producto','contacto','horario','tratamiento','reserva','cita','nosotros','oferta','service','pricing','price','product','contact','about','hours','offer'];
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
  return links.slice(0, 3);
}

function extractJsonLd(html: string): string {
  return [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap(s => { try { return [JSON.stringify(JSON.parse(s[1]))]; } catch { return []; } })
    .join('\n');
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { url } = await request.json();

  try {
    // Run all three in parallel: Apify (text), visual (colors), HTML fetch (contact hrefs + color fallback)
    const [apifyText, visual, htmlRaw] = await Promise.allSettled([
      scrapeWithApify(url),
      analyzeWebsite(url),
      fetch(url, { headers: { 'User-Agent': BOT_UA }, signal: AbortSignal.timeout(8_000) }).then(r => r.text()),
    ]);

    const html = htmlRaw.status === 'fulfilled' ? htmlRaw.value : '';
    const visualResult = visual.status === 'fulfilled' ? visual.value : null;
    const apifyContent = apifyText.status === 'fulfilled' ? apifyText.value : null;

    // Colors: screenshot (Claude Haiku) first, CSS extraction as fallback
    const screenshotHasColors = visualResult && visualResult.primaryColor !== '#1e293b' && visualResult.secondaryColor !== '#334155';
    let primaryColor: string | undefined;
    let secondaryColor: string | undefined;
    if (screenshotHasColors) {
      primaryColor = visualResult!.primaryColor;
      secondaryColor = visualResult!.secondaryColor;
    } else if (html) {
      const cssColors = await extractColorsFromStylesheets(url);
      primaryColor = cssColors?.primary;
      secondaryColor = cssColors?.secondary;
    }
    const widgetStyle = visualResult?.widgetStyle ?? 'bubble';

    // Contact info from HTML hrefs (wa.me, tel:, mailto:)
    const contactInfo = html ? extractContactFromHtml(html) : '';
    if (contactInfo) console.log('[scrape] contact from HTML:', contactInfo);

    // Text: Apify (renders JS fully) is primary; inject contact info if missing; HTML scraping as fallback
    if (apifyContent) {
      let text = apifyContent;
      if (contactInfo) {
        for (const line of contactInfo.split('\n').filter(Boolean)) {
          const digits = line.replace(/\D/g, '');
          const alreadyIn = digits.length >= 8
            ? text.replace(/\D/g, '').includes(digits.slice(-8))
            : text.toLowerCase().includes(line.slice(line.indexOf(': ') + 2, line.indexOf(': ') + 14).toLowerCase());
          if (!alreadyIn) {
            text = `${text}\n${line}`;
            console.log('[scrape] injected missing contact:', line);
          }
        }
      }
      return NextResponse.json({ text, primaryColor, secondaryColor, widgetStyle });
    }

    // Fallback: HTML scraping if Apify failed
    if (!html) return NextResponse.json({ error: 'No se pudo acceder a la URL' }, { status: 422 });
    const rawText = extractText(html);
    const jsonLd = extractJsonLd(html);
    const subLinks = extractInternalLinks(html, url);
    const subResults = await Promise.allSettled(
      subLinks.slice(0, 2).map(async (link) => {
        const r = await fetch(link, { headers: { 'User-Agent': BOT_UA }, signal: AbortSignal.timeout(5_000) });
        const h = await r.text();
        return `\n\n[Sección: ${link}]\n${extractText(h).slice(0, 4000)}`;
      })
    );
    const subTexts = subResults.filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled').map(r => r.value);
    let textContent = [contactInfo, jsonLd, rawText, ...subTexts].filter(Boolean).join('\n\n').slice(0, 20000);

    return NextResponse.json({ text: textContent, primaryColor, secondaryColor, widgetStyle });
  } catch {
    return NextResponse.json({ error: 'No se pudo acceder a la URL' }, { status: 422 });
  }
}
