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
  generated?: boolean;
  slot?: 'hero' | 'ambient_section' | 'ambient_footer';
  /** 0-100. Ausente en extracciones anteriores a 2026-08: usa `quality` como respaldo. */
  score?: number;
  /** Qué falla en la foto, en una frase. Vacío si no falla nada. */
  flaws?: string;
  /** Puesto asignado por el pase comparativo de `photo-rank`. */
  role?: PhotoRole;
  /** Por qué el pase comparativo la eligió (o la descartó). */
  roleReason?: string;
}

export type PhotoRole = 'hero' | 'destacada' | 'galeria' | 'descartada';

/** Traduce el score numérico al bucket antiguo, para no romper datos ya guardados. */
export function qualityFromScore(score: number): PhotoQuality {
  if (score >= 70) return 'buena';
  if (score >= 40) return 'regular';
  return 'mala';
}

/** Score efectivo de una foto, tolerando extracciones antiguas sin `score`. */
export function effectiveScore(m: PhotoMetadata): number {
  if (typeof m.score === 'number' && Number.isFinite(m.score)) return m.score;
  return m.quality === 'buena' ? 75 : m.quality === 'regular' ? 50 : 20;
}

const VALID_TYPES: PhotoType[] = [
  'exterior', 'interior', 'producto', 'trabajo_terminado',
  'equipo', 'logo', 'menu', 'ambiente', 'vehiculo', 'otro',
];

function buildPrompt(businessCategory: string): string {
  return `Eres el director de arte de un estudio de diseño web. Un cliente${businessCategory ? ` (${businessCategory})` : ''} te ha dado sus fotos de Google Maps y tienes que decidir cuáles merecen aparecer en su web nueva.

La pregunta que respondes NO es "¿está bien hecha esta foto?" sino **"¿pondría yo esta foto en la home de un cliente que me paga?"**. Son cosas distintas: una foto perfectamente nítida de una esquina cualquiera del local no vale nada, y una foto de móvil algo imperfecta de un plato espectacular sí vale.

Devuelve SOLO un objeto JSON (sin markdown, sin comentarios, sin texto extra):
{
  "type": "exterior|interior|producto|trabajo_terminado|equipo|logo|menu|ambiente|vehiculo|otro",
  "score": 0-100,
  "heroCandidate": true | false,
  "description": "una frase corta en español",
  "flaws": "qué falla, en una frase corta; cadena vacía si no falla nada"
}

**type:**
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

**score — sé duro. La media de las fotos de Google Maps ronda el 35.**
- 90-100: foto de catálogo. Composición intencionada, luz buena, sujeto claro y atractivo. Serviría de portada sin retocar. Casi ninguna foto de Google llega aquí.
- 70-89: buena de verdad. Nítida, bien encuadrada, se entiende qué vende el negocio y da buena impresión. Va en la web sin disculpas.
- 50-69: correcta pero anodina. Nítida y sin fallos graves, pero no aporta nada: no da ganas, no cuenta nada. Solo si no hay nada mejor.
- 30-49: floja. Luz plana o dura, encuadre descuidado, fondo desordenado, sujeto poco claro.
- 0-29: inservible. Borrosa, oscurísima, quemada por el flash, captura de pantalla, marca de agua, texto sobreimpreso, foto de un papel o un cartel, gente de espaldas sin contexto, o algo que no tiene que ver con el negocio.

**Penaliza fuerte (baja 20-40 puntos) cualquiera de estas, aunque la foto sea técnicamente correcta:**
- Desorden visible: cables, cajas, cubos, productos de limpieza, sillas apiladas, papeles.
- Fondo que distrae o corta el sujeto por la mitad.
- Caras de clientes reconocibles (problema legal y además queda mal).
- Estética de foto de aficionado con flash directo de noche.
- Fotos "de trámite": el suelo, una pared vacía, una puerta cerrada, el techo, un aparato suelto sin contexto.
- Cualquier texto o interfaz sobreimpresa.

**heroCandidate:** true SOLO si con esa única foto abrirías la web. Debe tener score >= 80, sujeto claro, espacio en la composición donde quepa un titular encima, y transmitir la esencia del negocio. Como mucho 1 de cada 8 fotos lo cumple. Ante la duda, false.

**description:** qué se ve, en una frase, en español, sin adjetivos vendedores. Ej: "Fachada con toldo verde y terraza en la acera".

**flaws:** lo que impide que sea mejor, en una frase. Ej: "cables y cajas al fondo a la derecha". Cadena vacía si la foto está limpia.`;
}

export async function fetchAsBase64(url: string): Promise<{ base64: string; mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' } | null> {
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
    score: 45,
    flaws: 'no se pudo analizar',
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
    const rawScore = Number(parsed.score);
    const score = Number.isFinite(rawScore) ? Math.min(100, Math.max(0, Math.round(rawScore))) : 45;
    // Un logo nunca debe colarse en la galería por mucho que esté bien fotografiado.
    const adjusted = type === 'logo' ? Math.min(score, 25) : score;

    return {
      url,
      type,
      quality: qualityFromScore(adjusted),
      score: adjusted,
      heroCandidate: !!parsed.heroCandidate && adjusted >= 80,
      description: typeof parsed.description === 'string' ? parsed.description.slice(0, 200) : '',
      flaws: typeof parsed.flaws === 'string' ? parsed.flaws.slice(0, 200) : '',
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
