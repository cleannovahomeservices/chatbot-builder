import Anthropic from '@anthropic-ai/sdk';
import { fetchAsBase64, effectiveScore } from './photo-classify';
import type { PhotoMetadata, PhotoRole } from './photo-classify';
import type { BusinessKind } from './extraction-format';

// Clasificar cada foto por separado no basta: un modelo que ve una sola imagen no
// puede saber que otras tres muestran lo mismo, ni cuál de las dos fachadas encaja
// mejor con el resto. Este pase le enseña todas las candidatas a la vez y le pide
// que componga el conjunto.

const MAX_CANDIDATES = 10;
const MAX_FEATURED = 6;

const KIND_BRIEF: Record<BusinessKind, string> = {
  food: 'La web va a vender apetito. Prioriza platos y ambiente del local por encima de fachadas.',
  lodging: 'La web va a vender el sitio donde alguien va a dormir. Prioriza estancias luminosas y el exterior más bonito.',
  beauty: 'La web va a vender resultados. Prioriza trabajos terminados sobre fotos del local.',
  service: 'La web va a vender confianza. Prioriza resultados terminados y limpios; el desorden de obra resta.',
  fitness: 'La web va a vender energía. Prioriza el espacio y el equipamiento con buena luz.',
  health: 'La web va a vender tranquilidad. Prioriza espacios limpios y luminosos; pocas fotos y bien elegidas.',
  retail: 'La web va a vender producto. Prioriza el producto bien presentado sobre el local vacío.',
  auto: 'La web va a vender competencia técnica. Prioriza el taller ordenado y los trabajos terminados.',
  education: 'La web va a vender futuro. Prioriza aulas y espacios con luz natural.',
  realestate: 'La web va a vender aspiración. Prioriza propiedades y espacios cuidados.',
  event: 'La web va a vender emoción. Prioriza las fotos más cinematográficas.',
  generic: 'Prioriza lo que mejor explique de un vistazo a qué se dedica el negocio.',
};

interface RankResult {
  hero: number | null;
  seleccion: Array<{ i: number; porque?: string }>;
  descartadas?: Array<{ i: number; porque?: string }>;
}

function buildInstructions(
  kind: BusinessKind,
  businessName: string,
  category: string,
  count: number,
): string {
  return `Eres el director de arte que monta la web de **${businessName}**${category ? ` (${category})` : ''}.

Arriba tienes ${count} fotos numeradas del 1 al ${count}, todas del mismo negocio. Ya han pasado un filtro de calidad individual, así que ninguna es basura. Tu trabajo ahora es distinto y es el que de verdad decide si la web queda bien: **componer el conjunto**.

${KIND_BRIEF[kind]}

Elige como mucho ${MAX_FEATURED} y ordénalas de mejor a peor. Criterios, por orden de importancia:

1. **Sin repetir.** Si dos fotos enseñan lo mismo (dos veces la fachada, dos platos parecidos, dos rincones del mismo cuarto), quédate solo con la mejor y descarta la otra. Repetir es lo que hace que una galería parezca relleno.
2. **Que el conjunto cuente algo completo.** Entre las elegidas debería verse variedad real: dónde es, qué hace, qué se lleva el cliente. Una galería de seis fotos del mismo tipo es peor que una de cuatro variadas.
3. **Que peguen entre ellas.** Descarta la que rompa el conjunto aunque sea buena suelta: una con luz de noche entre cinco de día, una saturadísima entre cinco neutras, una vertical de móvil entre cinco horizontales. Puestas juntas en un grid tienen que parecer de la misma web.
4. **Hero.** Elige la que abriría la web: sujeto claro, atractiva, con algo de espacio libre donde quepa un titular, y que resuma el negocio. Si ninguna está a esa altura, devuelve \`null\` — es mejor no tener hero real que poner uno mediocre.

Sé exigente: **si solo hay 3 fotos que aguanten, elige 3.** Rellenar hasta 6 con fotos mediocres empeora la web. Y si ninguna vale, devuelve la selección vacía.

Devuelve SOLO este JSON, sin markdown ni texto alrededor:
{
  "hero": <número de la foto hero, o null>,
  "seleccion": [{"i": <número>, "porque": "<media frase>"}],
  "descartadas": [{"i": <número>, "porque": "<por qué sobra: repetida, rompe el conjunto, no aporta...>"}]
}

El hero, si lo hay, tiene que aparecer también en "seleccion", el primero.`;
}

function fallbackByScore(candidates: PhotoMetadata[]): PhotoMetadata[] {
  const ordered = candidates.slice().sort((a, b) => effectiveScore(b) - effectiveScore(a));
  return ordered.map((m, i) => ({
    ...m,
    role: (i === 0 && m.heroCandidate ? 'hero' : i < MAX_FEATURED ? 'destacada' : 'galeria') as PhotoRole,
    roleReason: '',
  }));
}

/**
 * Ordena y asigna papel a las fotos reales viéndolas todas juntas.
 * Devuelve solo las candidatas (con `role` puesto); las que no entran quedan como 'descartada'.
 */
export async function rankPhotos(
  metadata: PhotoMetadata[],
  kind: BusinessKind,
  businessName: string,
  category: string,
): Promise<PhotoMetadata[]> {
  const candidates = metadata
    .filter(m => !m.generated && m.type !== 'logo' && effectiveScore(m) >= 40)
    .sort((a, b) => effectiveScore(b) - effectiveScore(a))
    .slice(0, MAX_CANDIDATES);

  if (candidates.length === 0) return [];
  // Con dos o menos no hay conjunto que componer: la comparación no aporta nada.
  if (candidates.length <= 2) return fallbackByScore(candidates);

  const images = await Promise.all(candidates.map(m => fetchAsBase64(m.url)));
  const usable = candidates
    .map((m, i) => ({ meta: m, img: images[i] }))
    .filter((x): x is { meta: PhotoMetadata; img: NonNullable<typeof images[number]> } => x.img !== null);

  if (usable.length <= 2) return fallbackByScore(usable.map(x => x.meta));

  const content: Anthropic.ContentBlockParam[] = [];
  usable.forEach((x, i) => {
    content.push({ type: 'text', text: `Foto ${i + 1}:` });
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: x.img.mediaType, data: x.img.base64 },
    });
  });
  content.push({ type: 'text', text: buildInstructions(kind, businessName, category, usable.length) });

  let parsed: RankResult | null = null;
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const msg = await client.messages.create({
      model: 'claude-opus-5',
      max_tokens: 4000,
      output_config: { effort: 'low' },
      messages: [{ role: 'user', content }],
    });
    const text = msg.content
      .filter(b => b.type === 'text')
      .map(b => (b as Anthropic.TextBlock).text)
      .join('\n');
    const match = text.match(/\{[\s\S]*\}/);
    if (match) parsed = JSON.parse(match[0]) as RankResult;
  } catch (e) {
    console.error('[rank] error:', e);
  }

  if (!parsed || !Array.isArray(parsed.seleccion)) {
    console.warn('[rank] sin respuesta usable, ordenando por score');
    return fallbackByScore(usable.map(x => x.meta));
  }

  const reasons = new Map<number, string>();
  for (const d of parsed.descartadas ?? []) {
    if (typeof d?.i === 'number') reasons.set(d.i, typeof d.porque === 'string' ? d.porque : '');
  }

  // El modelo numera desde 1 y puede repetir o inventarse índices: normaliza antes de usarlos.
  const picked: Array<{ meta: PhotoMetadata; why: string }> = [];
  const seen = new Set<number>();
  for (const s of parsed.seleccion) {
    const idx = Number(s?.i) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= usable.length || seen.has(idx)) continue;
    seen.add(idx);
    picked.push({ meta: usable[idx].meta, why: typeof s.porque === 'string' ? s.porque : '' });
    if (picked.length >= MAX_FEATURED) break;
  }

  if (picked.length === 0) {
    return usable.map(x => ({ ...x.meta, role: 'descartada' as PhotoRole, roleReason: '' }));
  }

  const heroIdx = Number(parsed.hero) - 1;
  const heroUrl = Number.isInteger(heroIdx) && heroIdx >= 0 && heroIdx < usable.length
    ? usable[heroIdx].meta.url
    : null;

  const result: PhotoMetadata[] = picked.map(p => ({
    ...p.meta,
    role: (p.meta.url === heroUrl ? 'hero' : 'destacada') as PhotoRole,
    roleReason: p.why,
  }));

  usable.forEach((x, i) => {
    if (seen.has(i)) return;
    result.push({ ...x.meta, role: 'descartada' as PhotoRole, roleReason: reasons.get(i + 1) ?? '' });
  });

  console.log(`[rank] ${picked.length} elegidas de ${usable.length}, hero=${heroUrl ? 'sí' : 'no'}`);
  return result;
}
