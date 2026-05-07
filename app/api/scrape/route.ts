import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { analyzeWebsite } from '@/lib/visual';

export const maxDuration = 120;

const BOT_UA = 'Mozilla/5.0 (compatible; ChatbotBuilder/1.0; +https://chatbot-builder-iota.vercel.app)';

// ─── Apify: Playwright renders full SPA ──────────────────────────────────────
// Only crawl 1 page, give it 80s — enough for any SPA to render completely.
async function scrapeWithApify(url: string): Promise<string | null> {
  const token = process.env.APIFY_API_KEY;
  if (!token) return null;
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~website-content-crawler/run-sync-get-dataset-items?token=${token}&timeout=80&memory=2048`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startUrls: [{ url }],
          maxCrawlPages: 1,
          maxCrawlDepth: 0,
          crawlerType: 'playwright:adaptive',
        }),
        signal: AbortSignal.timeout(95_000),
      }
    );
    if (!res.ok) { console.error('[apify] failed:', res.status); return null; }
    const items = await res.json() as Array<{ text?: string; url?: string }>;
    if (!Array.isArray(items) || items.length === 0) { console.error('[apify] empty result'); return null; }
    const text = items.map(i => (i.text ?? '').trim()).join('\n\n').slice(0, 20000);
    console.log(`[apify] ok, ${items.length} pages, ${text.length} chars`);
    return text.length > 50 ? text : null;
  } catch (e) {
    console.error('[apify] error:', e);
    return null;
  }
}

// ─── Jina AI: JS-rendering text reader ───────────────────────────────────────
async function fetchJinaText(url: string): Promise<string> {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'Accept': 'text/plain', 'X-No-Cache': 'true' },
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) { console.error('[jina] failed:', res.status); return ''; }
    const text = await res.text();
    console.log(`[jina] ok for ${url}, ${text.length} chars`);
    return text.slice(0, 15000);
  } catch (e) {
    console.error('[jina] error:', e);
    return '';
  }
}

// Fetches keyword-matched subpages with Jina (services, prices, contact, hours…)
// Parses links from BOTH raw HTML (static sites) and Jina markdown (SPAs where HTML is just a shell).
async function fetchSubpagesWithJina(html: string, jinaText: string, baseUrl: string): Promise<string> {
  const base = new URL(baseUrl);
  const keywords = [
    // Commerce / services
    'precio','tarifa','servicio','menu','carta','catalogo','producto','contacto','horario',
    'tratamiento','reserva','cita','oferta','service','pricing','price','product','contact',
    'about','hours','team','equipo','info',
    // Wellness / coaching / courses (critical for spas, yoga, coaching, breathwork sites)
    'clase','clases','retiro','retiros','practica','practicas','sesion','sesiones',
    'taller','talleres','formacion','curso','actividad','programa','respiracion',
    'sobre','coach','yoga','meditacion','bienestar','workshop','retreat','training',
    'course','nosotros','trabajo','oferta','evento','evento',
  ];
  const seen = new Set<string>([baseUrl, baseUrl.replace(/\/$/, ''), baseUrl + '/']);
  const links: string[] = [];

  const addLink = (raw: string, base2 = baseUrl) => {
    try {
      const u = new URL(raw, base2);
      if (u.hostname !== base.hostname) return;
      u.hash = ''; u.search = '';
      const href = u.href;
      if (seen.has(href)) return;
      if (keywords.some(k => href.toLowerCase().includes(k))) { seen.add(href); links.push(href); }
    } catch { /* skip */ }
  };

  // Raw HTML hrefs (works for static/SSR sites)
  for (const m of html.matchAll(/href="([^"#][^"]*?)"/gi)) addLink(m[1]);

  // Jina markdown links — absolute [text](https://...) and relative [text](/path)
  // This is the critical path for SPAs where raw HTML is just a JS shell
  for (const m of jinaText.matchAll(/\]\((https?:\/\/[^\)\s]+)\)/g)) addLink(m[1]);
  for (const m of jinaText.matchAll(/\]\((\/[^\)\s)]+)\)/g)) addLink(m[1]);

  if (links.length === 0) return '';
  const toFetch = links.slice(0, 4);
  console.log(`[jina-subpages] fetching ${toFetch.length} subpages:`, toFetch);
  const results = await Promise.allSettled(toFetch.map(link => fetchJinaText(link)));
  return results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled' && r.value.length > 50)
    .map((r, i) => `\n\n[${toFetch[i]}]\n${r.value}`)
    .join('');
}

// ─── JS bundle extraction: finds wa.me/phone in compiled Vite/React bundles ──
// CSS pseudo-element phones are invisible to DOM scrapers but present in the JS
async function extractFromJsBundle(url: string, html: string): Promise<string> {
  const found: string[] = [];
  try {
    // Find JS bundle URLs from the HTML shell
    const jsUrls: string[] = [];
    for (const m of html.matchAll(/src="([^"]+\.js[^"]*)"/gi)) {
      try {
        const u = new URL(m[1], url).href;
        if (!u.includes('chunk') || u.includes('index') || jsUrls.length === 0) jsUrls.push(u);
      } catch { /* skip */ }
    }

    for (const jsUrl of jsUrls.slice(0, 2)) {
      try {
        const res = await fetch(jsUrl, { headers: { 'User-Agent': BOT_UA }, signal: AbortSignal.timeout(8_000) });
        if (!res.ok) continue;
        const bundle = await res.text();

        // wa.me phone numbers
        for (const m of bundle.matchAll(/wa\.me\/(\d{9,13})/g)) {
          const num = '+' + m[1];
          if (!found.some(f => f.includes(m[1].slice(-9)))) {
            found.push(`WhatsApp: ${num}`);
            console.log('[jsbundle] wa.me found:', num);
          }
        }
        // tel: links
        for (const m of bundle.matchAll(/tel:([+\d\s\-]{9,15})/g)) {
          const num = m[1].trim();
          const digits = num.replace(/\D/g, '');
          if (digits.length >= 9 && !found.some(f => f.replace(/\D/g, '').includes(digits.slice(-8)))) {
            found.push(`Teléfono: ${num}`);
            console.log('[jsbundle] tel: found:', num);
          }
        }
        // Spanish mobile numbers (6XX/7XX)
        for (const m of bundle.matchAll(/(?<![\\/"'\w])(\+?34[\s\-]?)?([67]\d{2}[\s\-]?\d{2}[\s\-]?\d{2}[\s\-]?\d{2})(?![\\/"'\w\d])/g)) {
          const num = m[0].trim();
          const digits = num.replace(/\D/g, '');
          if (digits.length >= 9 && !found.some(f => f.replace(/\D/g, '').includes(digits.slice(-8)))) {
            found.push(`Teléfono: ${num}`);
            console.log('[jsbundle] phone found:', num);
          }
        }

        if (found.length > 0) break; // found what we need
      } catch { /* skip */ }
    }
  } catch (e) {
    console.error('[jsbundle] error:', e);
  }
  return found.join('\n');
}

// ─── HTML href contact extraction ────────────────────────────────────────────
function extractContactFromHtml(html: string): string {
  const phones = new Set<string>();
  const whatsapps = new Set<string>();
  const emails = new Set<string>();
  for (const m of html.matchAll(/href="tel:([^"]+)"/gi)) phones.add(decodeURIComponent(m[1].trim()));
  for (const m of html.matchAll(/href="https?:\/\/wa\.me\/(\d+)/gi)) whatsapps.add('+' + m[1]);
  for (const m of html.matchAll(/href="mailto:([^"?#]+)"/gi)) emails.add(m[1].trim());
  const parts: string[] = [];
  if (phones.size) parts.push('Teléfono: ' + [...phones].join(', '));
  if (whatsapps.size) parts.push('WhatsApp: ' + [...whatsapps].join(', '));
  if (emails.size) parts.push('Email: ' + [...emails].join(', '));
  return parts.join('\n');
}

// ─── Social media link extraction ────────────────────────────────────────────
function extractSocialLinks(html: string, jinaText: string): string {
  const found = new Map<string, string>();

  type Rule = { include: string; exclude: string[]; name: string };
  const rules: Rule[] = [
    { include: 'instagram.com/', exclude: ['/p/', '/reel/', '/explore/', '/stories/', 'sharer'], name: 'Instagram' },
    { include: 'youtube.com/', exclude: ['embed/', 'watch?v=', '/shorts/', 'share'], name: 'YouTube' },
    { include: 'facebook.com/', exclude: ['sharer', '/dialog/', '/plugins/', 'share', 'facebook.com/tr'], name: 'Facebook' },
    { include: 'tiktok.com/@', exclude: [], name: 'TikTok' },
    { include: 'twitter.com/', exclude: ['intent/', 'share?', '/status/'], name: 'Twitter' },
    { include: 'x.com/', exclude: ['intent/', 'share?', '/status/'], name: 'Twitter' },
    { include: 'linkedin.com/company/', exclude: [], name: 'LinkedIn' },
    { include: 'linkedin.com/in/', exclude: [], name: 'LinkedIn' },
  ];

  const hrefs = [...html.matchAll(/href="([^"]+)"/gi)].map(m => m[1]);
  const mdLinks = [...jinaText.matchAll(/\]\((https?:\/\/[^)\s]+)\)/g)].map(m => m[1]);

  for (const rawUrl of [...hrefs, ...mdLinks]) {
    const url = rawUrl.split('?')[0].split('#')[0];
    const lower = url.toLowerCase();
    for (const rule of rules) {
      if (found.has(rule.name)) continue;
      if (!lower.includes(rule.include)) continue;
      if (rule.exclude.some(ex => lower.includes(ex))) continue;
      found.set(rule.name, url);
    }
  }

  if (found.size === 0) return '';
  const lines = [...found.entries()].map(([name, url]) => `${name}: ${url}`);
  console.log('[social] found:', lines.join(' | '));
  return lines.join('\n');
}

// ─── CSS color extraction helpers (fallback for visual) ──────────────────────

function isNeutral(hex: string): boolean {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  return (max - min) / (max || 1) < 0.18 || (max + min) / 510 < 0.06 || (max + min) / 510 > 0.94;
}
function darken(hex: string, amount = 40): string {
  return '#' + [1, 3, 5].map(i => Math.max(0, parseInt(hex.slice(i, i + 2), 16) - amount).toString(16).padStart(2, '0')).join('');
}
function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1))).toString(16).padStart(2, '0'); };
  return `#${f(0)}${f(8)}${f(4)}`;
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
function extractColors(html: string): { primary: string; secondary: string } | null {
  const priority: string[] = [], fallback: string[] = [];
  for (const m of html.matchAll(/<meta[^>]+>/gi)) { const t = m[0]; if (/theme-color/i.test(t)) { const c = t.match(/content="(#[0-9a-fA-F]{6})"/i); if (c) priority.push(c[1].toLowerCase()); } }
  const styles = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]).join('\n');
  for (const m of styles.matchAll(/--(?:primary|brand|accent|main|theme|highlight)[\w-]*:\s*(#[0-9a-fA-F]{6})/gi)) priority.push(m[1].toLowerCase());
  for (const m of styles.matchAll(/(?:\.btn|button)[^{]*\{[^}]*background(?:-color)?:\s*(#[0-9a-fA-F]{6})/gi)) priority.push(m[1].toLowerCase());
  for (const m of html.slice(0, 6000).matchAll(/fill="(#[0-9a-fA-F]{6})"/gi)) priority.push(m[1].toLowerCase());
  for (const m of styles.matchAll(/#([0-9a-fA-F]{6})\b/gi)) fallback.push('#' + m[1].toLowerCase());
  const freq: Record<string, number> = {}; for (const c of fallback) freq[c] = (freq[c] || 0) + 1;
  const candidates = [...priority, ...Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([c]) => c)].filter(c => !isNeutral(c));
  if (!candidates.length) return null;
  const primary = candidates[0];
  return { primary, secondary: candidates.find(c => c !== primary) ?? darken(primary) };
}
function extractHslVars(cssText: string): { primary: string; secondary: string } | null {
  const root = cssText.match(/:root\s*\{([^}]+)\}/)?.[1]; if (!root) return null;
  const getVar = (name: string) => { const m = root.match(new RegExp(`--${name}:\\s*(\\d+\\.?\\d*)\\s+(\\d+\\.?\\d*)%\\s+(\\d+\\.?\\d*)%`)); if (!m) return null; const h = hslToHex(+m[1], +m[2], +m[3]); return isNeutral(h) ? null : h; };
  const primary = getVar('primary'); if (!primary) return null;
  const sec = getVar('secondary') ?? getVar('accent') ?? darken(primary, 20);
  return { primary, secondary: sec && !isNeutral(sec) ? sec : darken(primary, 20) };
}
async function extractColorsFromStylesheets(url: string): Promise<{ primary: string; secondary: string } | null> {
  try {
    const htmlRes = await fetch(url, { headers: { 'User-Agent': BOT_UA }, signal: AbortSignal.timeout(6_000) });
    if (!htmlRes.ok) return null;
    const html = await htmlRes.text();
    const direct = extractColors(html); if (direct) return direct;
    const cssUrls: string[] = [];
    for (const m of html.matchAll(/<link[^>]+href="([^"]+\.css[^"]*)"[^>]*/gi)) { try { cssUrls.push(new URL(m[1], url).href); } catch { /* skip */ } }
    if (!cssUrls.length) { const p = mostSaturated([...new Set([...html.matchAll(/#([0-9a-fA-F]{6})\b/g)].map(m => '#' + m[1]))]); return p ? { primary: p, secondary: darken(p) } : null; }
    let css = '';
    for (const u of cssUrls.slice(0, 2)) { try { const r = await fetch(u, { headers: { 'User-Agent': BOT_UA }, signal: AbortSignal.timeout(5_000) }); if (r.ok) css += (await r.text()).slice(0, 120000); if (css.length > 120000) break; } catch { /* skip */ } }
    if (!css) return null;
    const hsl = extractHslVars(css); if (hsl) { console.log('[css] HSL:', hsl.primary); return hsl; }
    const fromCss = extractColors(`<style>${css}</style>`); if (fromCss) return fromCss;
    const p = mostSaturated([...new Set([...css.matchAll(/#([0-9a-fA-F]{6})\b/g)].map(m => '#' + m[1]))]); return p ? { primary: p, secondary: darken(p) } : null;
  } catch { return null; }
}

// ─── HTML text extraction (last-resort fallback) ─────────────────────────────
function extractText(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<h[1-3][^>]*>/gi, '\n\n## ').replace(/<\/h[1-6]>/gi, '\n').replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<br\s*\/?>/gi, '\n').replace(/<\/p>/gi, '\n\n').replace(/<\/div>/gi, '\n')
    .replace(/<t[dh][^>]*>/gi, ' | ').replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&euro;/g, '€')
    .replace(/[ \t]+/g, ' ').replace(/\n +/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
function extractJsonLd(html: string): string {
  return [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)]
    .flatMap(s => { try { return [JSON.stringify(JSON.parse(s[1]))]; } catch { return []; } }).join('\n');
}
function extractInternalLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl); const seen = new Set<string>(); const links: string[] = [];
  const kw = ['precio','tarifa','servicio','menu','carta','catalogo','producto','contacto','horario','tratamiento','reserva','cita','nosotros','oferta','service','pricing','price','product','contact','about','hours','clase','clases','retiro','retiros','practica','practicas','sesion','sesiones','taller','talleres','formacion','curso','actividad','programa','sobre','coach','yoga','meditacion','bienestar','workshop','retreat','training','course'];
  for (const m of html.matchAll(/href="([^"#][^"]*?)"/gi)) { try { const u = new URL(m[1], baseUrl); if (u.hostname !== base.hostname) continue; u.hash = ''; u.search = ''; const h = u.href; if (h === baseUrl || seen.has(h)) continue; if (kw.some(k => h.toLowerCase().includes(k))) { seen.add(h); links.push(h); } } catch { /* skip */ } }
  return links.slice(0, 3);
}

// ─── Inject contact info if missing from text ────────────────────────────────
function injectContactIfMissing(text: string, contactInfo: string): string {
  if (!contactInfo) return text;
  let result = text;
  for (const line of contactInfo.split('\n').filter(Boolean)) {
    const value = line.slice(line.indexOf(': ') + 2);
    const digits = value.replace(/\D/g, '');
    let alreadyIn: boolean;
    if (digits.length >= 8) {
      alreadyIn = result.replace(/\D/g, '').includes(digits.slice(-8));
    } else if (value.startsWith('http')) {
      const pathMatch = value.match(/https?:\/\/[^/]+\/(.{3,})/);
      const path = (pathMatch?.[1] ?? '').slice(0, 24);
      alreadyIn = path.length > 2 && result.toLowerCase().includes(path.toLowerCase());
    } else {
      alreadyIn = result.toLowerCase().includes(value.toLowerCase().slice(0, 12));
    }
    if (!alreadyIn) { result = `${result}\n${line}`; console.log('[scrape] injected contact:', line); }
  }
  return result;
}

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { url } = await request.json();

  try {
    // Phase 1: Start everything in parallel
    // - Apify (80s timeout, 1 page only — enough for homepage SPA render)
    // - Jina (45s timeout — backup text source)
    // - Visual (colors via Claude Haiku screenshot — fast, working)
    // - HTML fetch (for contact hrefs, CSS color fallback, JS bundle URL discovery)
    const [apifyResult, jinaResult, visualResult, htmlResult] = await Promise.allSettled([
      scrapeWithApify(url),
      fetchJinaText(url),
      analyzeWebsite(url),
      fetch(url, { headers: { 'User-Agent': BOT_UA }, signal: AbortSignal.timeout(8_000) }).then(r => r.text()),
    ]);

    const html = htmlResult.status === 'fulfilled' ? htmlResult.value : '';
    const visual = visualResult.status === 'fulfilled' ? visualResult.value : null;
    const apifyText = apifyResult.status === 'fulfilled' ? apifyResult.value : null;
    const jinaText = jinaResult.status === 'fulfilled' ? jinaResult.value : '';

    console.log(`[scrape] apify=${apifyText?.length ?? 'null'} jina=${jinaText.length} html=${html.length}`);

    // Colors: screenshot (Claude Haiku) first, CSS extraction as fallback
    const screenshotHasColors = visual && visual.primaryColor !== '#1e293b' && visual.secondaryColor !== '#334155';
    let primaryColor: string | undefined;
    let secondaryColor: string | undefined;
    if (screenshotHasColors) {
      primaryColor = visual!.primaryColor;
      secondaryColor = visual!.secondaryColor;
    } else if (html) {
      const cssColors = await extractColorsFromStylesheets(url);
      primaryColor = cssColors?.primary;
      secondaryColor = cssColors?.secondary;
    }
    const widgetStyle = visual?.widgetStyle ?? 'bubble';

    // Phase 2: Extract contact info from all sources
    // HTML hrefs (static HTML of SPA — probably empty for Vite apps)
    let contactInfo = html ? extractContactFromHtml(html) : '';

    // JS bundle — finds wa.me/phone even in CSS pseudo-element sites
    if (html) {
      const bundleContact = await extractFromJsBundle(url, html);
      if (bundleContact) {
        for (const line of bundleContact.split('\n').filter(Boolean)) {
          const digits = line.replace(/\D/g, '');
          if (!contactInfo.includes(digits.slice(-8))) {
            contactInfo = contactInfo ? `${contactInfo}\n${line}` : line;
          }
        }
      }
    }

    // Jina markdown (wa.me links visible in rendered page)
    if (jinaText) {
      for (const m of jinaText.matchAll(/wa\.me\/(\d+)/gi)) {
        const num = '+' + m[1];
        if (!contactInfo.includes(m[1].slice(-9))) {
          contactInfo = contactInfo ? `${contactInfo}\nWhatsApp: ${num}` : `WhatsApp: ${num}`;
          console.log('[scrape] wa.me from jina:', num);
        }
      }
    }

    // Social media links (Instagram, YouTube, TikTok, etc.)
    if (html) {
      const socialInfo = extractSocialLinks(html, jinaText);
      if (socialInfo) {
        contactInfo = contactInfo ? `${contactInfo}\n${socialInfo}` : socialInfo;
      }
    }

    if (contactInfo) console.log('[scrape] final contactInfo:', contactInfo);

    // Jina subpages: fetch keyword-matched subpages in parallel (services, prices, contact…)
    // Parses links from both raw HTML and Jina markdown — critical for SPAs where HTML is a JS shell.
    const jinaSubpages = html ? await fetchSubpagesWithJina(html, jinaText, url) : '';
    if (jinaSubpages) console.log(`[jina-subpages] got ${jinaSubpages.length} chars`);

    // Text: Apify > Jina > HTML fallback (subpage content appended to whichever wins)
    let textContent: string;
    if (apifyText) {
      console.log('[scrape] using apify text');
      textContent = injectContactIfMissing(apifyText + jinaSubpages, contactInfo);
    } else if (jinaText && jinaText.length > 100) {
      console.log('[scrape] using jina text');
      textContent = injectContactIfMissing(jinaText + jinaSubpages, contactInfo);
    } else if (html) {
      console.log('[scrape] fallback to html scraping');
      const rawText = extractText(html);
      const jsonLd = extractJsonLd(html);
      const subLinks = extractInternalLinks(html, url);
      const subResults = await Promise.allSettled(
        subLinks.slice(0, 2).map(async link => {
          const r = await fetch(link, { headers: { 'User-Agent': BOT_UA }, signal: AbortSignal.timeout(5_000) });
          return `\n\n[${link}]\n${extractText(await r.text()).slice(0, 4000)}`;
        })
      );
      const subTexts = subResults.filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled').map(r => r.value);
      textContent = injectContactIfMissing(
        [contactInfo, jsonLd, rawText, ...subTexts].filter(Boolean).join('\n\n').slice(0, 20000),
        contactInfo
      );
    } else {
      return NextResponse.json({ error: 'No se pudo acceder a la URL' }, { status: 422 });
    }

    return NextResponse.json({ text: textContent, primaryColor, secondaryColor, widgetStyle });
  } catch {
    return NextResponse.json({ error: 'No se pudo acceder a la URL' }, { status: 422 });
  }
}
