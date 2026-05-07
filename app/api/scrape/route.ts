import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';

function extractColors(html: string): { primary: string; secondary: string } | null {
  // Extract <style> blocks
  const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)]
    .map(m => m[1])
    .join('\n');

  // 1. CSS variables with brand/primary/accent names
  const varPattern = /--(?:primary|brand|accent|main|color|theme|highlight)(?:[-\w]*)?:\s*(#[0-9a-fA-F]{6})/gi;
  const cssVarColors: string[] = [];
  for (const m of styleBlocks.matchAll(varPattern)) cssVarColors.push(m[1].toLowerCase());

  // 2. Button/CTA background colors
  const btnPattern = /(?:\.btn|\.button|button)[^{]*\{[^}]*background(?:-color)?:\s*(#[0-9a-fA-F]{6})/gi;
  const btnColors: string[] = [];
  for (const m of styleBlocks.matchAll(btnPattern)) btnColors.push(m[1].toLowerCase());

  // 3. All hex colors in styles — count frequency
  const allHex: string[] = [];
  for (const m of styleBlocks.matchAll(/#([0-9a-fA-F]{6})\b/gi)) allHex.push('#' + m[1].toLowerCase());
  // Also check inline styles in HTML
  for (const m of html.matchAll(/style="[^"]*color:\s*(#[0-9a-fA-F]{6})/gi)) allHex.push(m[1].toLowerCase());

  const isNeutral = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    const lum = (max + min) / 510;
    return sat < 0.18 || lum < 0.06 || lum > 0.94;
  };

  const candidates = [...cssVarColors, ...btnColors, ...allHex].filter(c => !isNeutral(c));
  if (candidates.length === 0) return null;

  const freq: Record<string, number> = {};
  for (const c of candidates) freq[c] = (freq[c] || 0) + 1;
  const sorted = Object.entries(freq).sort((a, b) => b[1] - a[1]);

  const primary = sorted[0][0];
  // Pick secondary from top candidates that differs enough
  const secondary = sorted.find(([c]) => c !== primary)?.[0] ?? darken(primary);

  return { primary, secondary };
}

function darken(hex: string): string {
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - 30);
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - 30);
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - 30);
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
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
    'precio', 'tarifa', 'servicio', 'menu', 'carta', 'catalogo',
    'contacto', 'horario', 'tratamiento', 'about', 'service', 'pricing',
    'barberia', 'peluqueria', 'reserva', 'cita', 'nosotros',
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

export async function POST(request: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { url } = await request.json();

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': BOT_UA },
      signal: AbortSignal.timeout(10_000),
    });
    const html = await res.text();

    const rawText = extractText(html);
    const jsonLd = extractJsonLd(html);
    const colors = extractColors(html);

    // Scrape sub-pages that likely contain prices / services / contact info
    const subLinks = extractInternalLinks(html, url);
    const subResults = await Promise.allSettled(
      subLinks.slice(0, 2).map(async (link) => {
        const r = await fetch(link, {
          headers: { 'User-Agent': BOT_UA },
          signal: AbortSignal.timeout(5_000),
        });
        const h = await r.text();
        return `\n\n[Sección: ${link}]\n${extractText(h).slice(0, 4000)}`;
      })
    );
    const subTexts = subResults
      .filter((r): r is PromiseFulfilledResult<string> => r.status === 'fulfilled')
      .map(r => r.value);

    // JSON-LD first (structured data with prices), then main page, then sub-pages
    const combined = [jsonLd, rawText, ...subTexts].filter(Boolean).join('\n\n').slice(0, 20000);

    return NextResponse.json({
      text: combined,
      primaryColor: colors?.primary ?? null,
      secondaryColor: colors?.secondary ?? null,
    });
  } catch {
    return NextResponse.json({ error: 'No se pudo acceder a la URL' }, { status: 422 });
  }
}
