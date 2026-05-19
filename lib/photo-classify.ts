import Anthropic from '@anthropic-ai/sdk';

export type PhotoType =
  | 'exterior'
  | 'interior'
  | 'producto'
  | 'trabajo_terminado'
  | 'equipo'
  | 'logo'
  | 'menu'
  | 'ambiente'
  | 'vehiculo'
  | 'otro';

export type PhotoQuality = 'buena' | 'regular' | 'mala';

export interface PhotoMetadata {
  url: string;
  type: PhotoType;
  quality: PhotoQuality;
  heroCandidate: boolean;
  description: string;
}

const VALID_TYPES: PhotoType[] = [
  'exterior', 'interior', 'producto', 'trabajo_terminado',
  'equipo', 'logo', 'menu', 'ambiente', 'vehiculo', 'otro',
];
const VALID_QUALITIES: PhotoQuality[] = ['buena', 'regular', 'mala'];

function buildPrompt(businessCategory: string): string {
  return `Clasifica esta foto de un negocio${businessCategory ? ` (${businessCategory})` : ''} para decidir si y cómo usarla en su web.

Devuelve SOLO un objeto JSON (sin markdown, sin comentarios, sin texto extra):
{
  "type": "exterior|interior|producto|trabajo_terminado|equipo|logo|menu|ambiente|vehiculo|otro",
  "quality": "buena|regular|mala",
  "heroCandidate": true | false,
  "description": "una frase corta en español"
}

Criterios:
- type:
  - "exterior" = fachada, cartel del local visto desde fuera
  - "interior" = vista del interior del local con suficiente contexto para ver el espacio
  - "producto" = un plato, una bebida, una pieza vendida, un producto destacado
  - "trabajo_terminado" = resultado de un servicio (limpieza terminada, instalación hecha, peinado finalizado, antes/después)
  - "equipo" = personas trabajando, retrato del dueño/staff
  - "logo" = logo o cartel con el nombre del negocio sin contexto del local
  - "menu" = carta, lista de precios, pizarra con servicios
  - "ambiente" = detalle decorativo, primer plano de un objeto, ambiente sin información clara
  - "vehiculo" = furgoneta o coche del negocio
  - "otro" = no encaja en lo anterior
- quality:
  - "buena" = nítida, bien iluminada, encuadre cuidado, profesional, sin elementos distractorios. Apta para usar tal cual en una web.
  - "regular" = usable pero floja: algo borrosa, iluminación irregular o composición simple.
  - "mala" = NO usar nunca. Foto borrosa, oscurísima, screenshot de pantalla, captura con interfaz visible, foto con flash mal, marca de agua, texto sobreimpreso feo, totalmente desenfocada, encuadre absurdo, o foto irrelevante para el negocio.
- heroCandidate: true SOLO si la foto es excepcional: nítida, atractiva, transmite la esencia del negocio y serviría como portada de la web. Sé estricto: máximo 1 de cada 5 fotos debería ser hero candidate.
- description: una frase breve en español que diga qué se ve (ej: "Fachada del restaurante con terraza al sol", "Plato de paella servido"). Sin adjetivos exagerados.

Importante: si la imagen está corrupta, en blanco, es un logo aislado sin valor visual, o un screenshot → quality = "mala".`;
}

async function fetchAsBase64(url: string): Promise<{ base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' } | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return null;
    const contentType = (res.headers.get('content-type') ?? 'image/jpeg').toLowerCase();
    let mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' = 'image/jpeg';
    if (contentType.includes('png')) mediaType = 'image/png';
    else if (contentType.includes('webp')) mediaType = 'image/webp';
    else if (contentType.includes('gif')) mediaType = 'image/gif';
    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.byteLength > 5 * 1024 * 1024) return null; // 5MB cap to avoid huge payloads
    return { base64: buffer.toString('base64'), mediaType };
  } catch {
    return null;
  }
}

function fallbackMeta(url: string): PhotoMetadata {
  return {
    url,
    type: 'otro',
    quality: 'regular',
    heroCandidate: false,
    description: '',
  };
}

export async function classifyPhoto(
  client: Anthropic,
  url: string,
  businessCategory: string,
): Promise<PhotoMetadata> {
  const img = await fetchAsBase64(url);
  if (!img) return fallbackMeta(url);

  try {
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.base64 } },
          { type: 'text', text: buildPrompt(businessCategory) },
        ],
      }],
    });

    const text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return fallbackMeta(url);

    const parsed = JSON.parse(jsonMatch[0]);
    const type: PhotoType = VALID_TYPES.includes(parsed.type) ? parsed.type : 'otro';
    const quality: PhotoQuality = VALID_QUALITIES.includes(parsed.quality) ? parsed.quality : 'regular';

    return {
      url,
      type,
      quality,
      heroCandidate: !!parsed.heroCandidate,
      description: typeof parsed.description === 'string' ? parsed.description.slice(0, 200) : '',
    };
  } catch (e) {
    console.error('[classify] error for', url, e);
    return fallbackMeta(url);
  }
}

export async function classifyPhotos(
  urls: string[],
  businessCategory: string,
): Promise<PhotoMetadata[]> {
  if (urls.length === 0) return [];
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  // Pool concurrente de 8 a la vez para no saturar
  const POOL = 8;
  const results: PhotoMetadata[] = new Array(urls.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(POOL, urls.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= urls.length) return;
      results[i] = await classifyPhoto(client, urls[i], businessCategory);
    }
  });
  await Promise.all(workers);
  return results;
}
