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
}

const FALLBACK: VisualAnalysis = {
  primaryColor: '#1e293b',
  secondaryColor: '#334155',
  widgetStyle: 'bubble',
};

export async function analyzeWebsite(url: string): Promise<VisualAnalysis> {
  const accessKey = process.env.SCREENSHOTONE_ACCESS_KEY;
  if (!accessKey) return FALLBACK;

  try {
    const ssUrl = `https://api.screenshotone.com/take?access_key=${accessKey}&url=${encodeURIComponent(url)}&format=jpg&viewport_width=1280&viewport_height=900&full_page=false&image_quality=75&block_ads=true&block_cookie_banners=true&timeout=15`;

    const res = await fetch(ssUrl, { signal: AbortSignal.timeout(18_000) });
    if (!res.ok) {
      console.error('[visual] screenshot failed:', res.status);
      return FALLBACK;
    }

    const imageBuffer = await res.arrayBuffer();
    const base64Image = Buffer.from(imageBuffer).toString('base64');

    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: 'image/jpeg', data: base64Image },
          },
          {
            type: 'text',
            text: `Analiza esta captura de pantalla de una web de negocio.
Devuelve SOLO un objeto JSON válido, sin explicación:

{"primaryColor":"#hex","secondaryColor":"#hex","widgetStyle":"..."}

Para primaryColor y secondaryColor:
- Busca los colores reales de la marca en botones, header, logo, CTAs.
- primaryColor: color dominante de marca (no negro puro, no blanco puro).
- secondaryColor: un color DIFERENTE que complemente al primary (contraste visible, no solo versión más oscura del mismo tono).
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
    if (!match) return FALLBACK;

    const parsed = JSON.parse(match[0]) as Partial<VisualAnalysis>;
    const validStyles: WidgetStyle[] = ['bubble','minimal','rounded','dark','neon','corporate','soft','floating','compact','retro'];

    return {
      primaryColor: /^#[0-9a-fA-F]{6}$/.test(parsed.primaryColor ?? '') ? parsed.primaryColor! : FALLBACK.primaryColor,
      secondaryColor: /^#[0-9a-fA-F]{6}$/.test(parsed.secondaryColor ?? '') ? parsed.secondaryColor! : FALLBACK.secondaryColor,
      widgetStyle: validStyles.includes(parsed.widgetStyle as WidgetStyle) ? parsed.widgetStyle as WidgetStyle : FALLBACK.widgetStyle,
    };
  } catch (e) {
    console.error('[visual] analysis error:', e);
    return FALLBACK;
  }
}
