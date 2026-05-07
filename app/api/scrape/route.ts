import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { analyzeWebsite } from '@/lib/visual';

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

function extractColors(html: string): { primary: string; secondary: string } | null {
  const priority: string[] = [];   // high-confidence signals
  const fallback: string[] = [];   // frequency-based

  // 1. <meta name="theme-color"> — explicit brand color set by the site owner
  for (const m of html.matchAll(/<meta[^>]+>/gi)) {
    const tag = m[0];
    if (/theme-color|msapplication-tilecolor/i.test(tag)) {
      const c = tag.match(/content="(#[0-9a-fA-F]{6})"/i);
      if (c) priority.push(c[1].toLowerCase());
    }
  }

  // 2. CSS custom properties with brand/primary/accent names
  const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
    .map(m => m[1]).join('\n');
  const varPattern = /--(?:primary|brand|accent|main|color|theme|highlight)(?:[-\w]*)?:\s*(#[0-9a-fA-F]{6})/gi;
  for (const m of styleBlocks.matchAll(varPattern)) priority.push(m[1].toLowerCase());

  // 3. Button / CTA background colors
  const btnPattern = /(?:\.btn|\.button|button)[^{]*\{[^}]*background(?:-color)?:\s*(#[0-9a-fA-F]{6})/gi;
  for (const m of styleBlocks.matchAll(btnPattern)) priority.push(m[1].toLowerCase());

  // 4. SVG fill colors in the first 6 000 chars (usually logo / header area)
  for (const m of html.slice(0, 6000).matchAll(/fill="(#[0-9a-fA-F]{6})"/gi))
    priority.push(m[1].toLowerCase());

  // 5. All hex colors — frequency analysis as last resort
  for (const m of styleBlocks.matchAll(/#([0-9a-fA-F]{6})\b/gi)) fallback.push('#' + m[1].toLowerCase());
  for (const m of html.matchAll(/style="[^"]*(?:background|color)(?:-color)?:\s*(#[0-9a-fA-F]{6})/gi))
    fallback.push(m[1].toLowerCase());

  const freq: Record<string, number> = {};
  for (const c of fallback) freq[c] = (freq[c] || 0) + 1;
  const byFreq = Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([c]) => c);

  const candidates = [...priority, ...byFreq].filter(c => !isNeutral(c));
  if (candidates.length === 0) return null;

  const primary = candidates[0];
  const secondary = candidates.find(c => c !== primary) ?? darken(primary);
  return { primary, secondary };
}

function extractJsonLd(html: string): string {
  const scripts = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  const results: string[] = [];
  for (const s of scripts) {
    try {
      const obj = JSON.parse(s[1]);
      results.push(JSON.stringify(obj));
    } catch { /* skip malformed */ }
  }
  return results.join('\n');
}

function extractText(html: string): string {
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Preserve structure before stripping tags
  text = text
    .replace(/<h[1-3][^>]*>/gi, '\n\n## ')
    .replace(/<h[4-6][^>]*>/gi, '\n\n### ')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n- ')
    .replace(/<\/li>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<t[dh][^>]*>/gi, ' | ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&euro;/g, '€')
    .replace(/&#8364;/g, '€')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n +/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

function extractInternalLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const keywords = [
    // Spanish
    'precio', 'tarifa', 'servicio', 'menu', 'carta', 'catalogo', 'producto',
    'contacto', 'horario', 'tratamiento', 'reserva', 'cita', 'nosotros', 'oferta',
    // English
    'service', 'pricing', 'price', 'menu', 'product', 'contact', 'about', 'hours', 'offer',
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
    } catch { /* skip malformed */ }
  }

  return links.slice(0, 3);
}

const BOT_UA = 'Mozilla/5.0 (compatible; ChatbotBuilder/1.0; +https://chatbot-builder-iota.vercel.app)';

// Pick the most saturated non-black/white hex from a list — last-resort color recovery.
function mostSaturated(hexList: string[]): string | null {
  let best: { hex: string; sat: number } | null = null;
  for (const hex of hexList) {
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const lum = (max + min) / 510;
    if (lum < 0.04 || lum > 0.96) continue; // pure black/white
    const sat = max === 0 ? 0 : (max - min) / max;
    if (!best || sat > best.sat) best = { hex, sat };
  }
  return best && best.sat > 0.04 ? best.hex : null;
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { url } = await request.json();

  try {
    // PRIMARY: Screenshot(s) → Claude Sonnet → colors + style + business text
    const visual = await analyzeWebsite(url);

    if (visual.businessInfo) {
      // Visual analysis got everything — use it directly
      return NextResponse.json({
        text: visual.businessInfo,
        primaryColor: visual.primaryColor,
        secondaryColor: visual.secondaryColor,
        widgetStyle: visual.widgetStyle,
      });
    }

    // FALLBACK: HTML scraping (for when Screenshotone is unavailable)
    const res = await fetch(url, {
      headers: { 'User-Agent': BOT_UA },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return NextResponse.json({ error: 'No se pudo acceder a la URL' }, { status: 422 });
    const html = await res.text();

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
    const subTexts = subResults
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
      .map(r => r.value);
    const textContent = [jsonLd, rawText, ...subTexts].filter(Boolean).join('\n\n').slice(0, 20000);

    // Use colors from visual (even without businessInfo they're valid) or fall back to CSS
    let primaryColor = visual.primaryColor !== '#1e293b' ? visual.primaryColor : '';
    let secondaryColor = visual.secondaryColor !== '#334155' ? visual.secondaryColor : '';

    if (!primaryColor) {
      let colors = extractColors(html);
      if (!colors) {
        const allHex = [...html.matchAll(/#([0-9a-fA-F]{6})\b/g)].map(m => '#' + m[1].toLowerCase());
        const primary = mostSaturated([...new Set(allHex)]);
        if (primary) colors = { primary, secondary: darken(primary) };
      }
      colors ??= { primary: '#1e293b', secondary: '#334155' };
      primaryColor = colors.primary;
      secondaryColor = colors.secondary;
    }

    return NextResponse.json({
      text: textContent,
      primaryColor,
      secondaryColor,
      widgetStyle: visual.widgetStyle,
    });
  } catch {
    return NextResponse.json({ error: 'No se pudo acceder a la URL' }, { status: 422 });
  }
}
