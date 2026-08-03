import OpenAI from 'openai';
import { createAdminClient } from './supabase/admin';
import type { PhotoMetadata } from './photo-classify';
import type { BusinessKind } from './extraction-format';

type Slot = 'hero' | 'ambient_section' | 'ambient_footer';

interface SlotConfig {
  size: '1024x1024' | '1536x1024' | '1024x1536';
  quality: 'low' | 'medium';
  description: string;
}

const SLOT_CONFIG: Record<Slot, SlotConfig> = {
  hero: {
    size: '1536x1024',
    quality: 'medium',
    description: 'Imagen ambiental generada para el hero / portada',
  },
  ambient_section: {
    // Esta se ve entera y a buen tamaño en la web; en 'low' se le nota el grano de IA.
    size: '1024x1024',
    quality: 'medium',
    description: 'Imagen ambiental generada para una sección secundaria',
  },
  ambient_footer: {
    size: '1536x1024',
    quality: 'low',
    description: 'Imagen ambiental generada para el footer o CTA final',
  },
};

const STYLE_BASE =
  'Editorial photography, natural light, cinematic, soft colors, no text, no logos, no watermarks, no people faces clearly visible, no AI artifacts, ultra realistic, magazine quality.';

const KIND_PROMPTS: Record<BusinessKind, { hero: string; section: string; footer: string }> = {
  food: {
    hero: 'Warm interior of a cozy restaurant, dim ambient lighting, wooden tables, candles, blurred background, intimate atmosphere',
    section: 'Close-up of a beautifully plated gourmet dish on a rustic ceramic plate, top view, natural light, shallow depth of field',
    footer: 'Cozy restaurant terrace at dusk, warm string lights, empty wooden tables, atmospheric evening',
  },
  lodging: {
    hero: 'Luxurious bedroom with linen white sheets, large window with natural light, plants, minimalist Scandinavian style, hotel boutique aesthetic',
    section: 'Cozy reading nook with armchair, blanket, books, natural daylight, soft tones',
    footer: 'Beautiful exterior of a boutique hotel at golden hour, mediterranean architecture, soft pastels',
  },
  beauty: {
    hero: 'Elegant beauty salon interior, marble counter, gold accents, soft pink and nude tones, mirror with hollywood lights, minimalist editorial style',
    section: 'Close-up of professional hair styling tools arranged on marble, blush pink background, flat lay',
    footer: 'Soft pastel abstract texture of silk fabric, blurred dreamy background, light pink and nude',
  },
  // Genérico de servicios: casa terminada y bonita, nunca obra a medias ni antes/después feo.
  service: {
    hero: 'Beautiful finished living room of a well-kept home, immaculate and tidy, warm natural light through large windows, everything in its place, aspirational but realistic',
    section: 'Spotlessly clean modern kitchen, natural sunlight streaming through window, immaculate surfaces, nothing out of place',
    footer: 'Well-kept suburban home exterior at golden hour, tidy front garden, warm inviting light',
  },
  fitness: {
    hero: 'Modern industrial gym interior with concrete floor, black equipment, dramatic side lighting, empty space, motivational athletic atmosphere',
    section: 'Close-up of professional gym equipment, rubber and steel textures, dramatic lighting',
    footer: 'Wide shot of an empty modern fitness space, industrial loft style, morning light through large windows',
  },
  health: {
    hero: 'Modern medical clinic interior, white and soft blue tones, plants, natural light, calming professional atmosphere',
    section: 'Close-up of a clean modern dental or medical chair area, soft blue tones, sterile premium feeling',
    footer: 'Bright modern waiting room with comfortable seating, plants, large window with daylight',
  },
  retail: {
    hero: 'Beautifully curated boutique store interior, wooden shelves, minimalist styling, warm spot lighting, premium retail aesthetic',
    section: 'Flat lay of curated products on a soft pastel background, magazine editorial style',
    footer: 'Charming shop window from outside at evening with warm interior lighting',
  },
  auto: {
    hero: 'Modern professional auto repair workshop, polished concrete floor, organized tools on wall, dramatic side lighting, no people, premium garage feeling',
    section: 'Close-up of professional mechanic tools neatly arranged, steel and rubber textures, dramatic light',
    footer: 'Wide shot of a clean modern car workshop interior, premium feeling, low key lighting',
  },
  education: {
    hero: 'Bright modern classroom or learning space, books, plants, natural light through large windows, inviting and inspiring',
    section: 'Close-up of open books, notebook and pencil on a wooden desk, warm sunlight, cozy study atmosphere',
    footer: 'Wide shot of an empty modern library or study space with bookshelves, warm light',
  },
  realestate: {
    hero: 'Stunning luxury real estate exterior at sunset, modern architecture, large windows, lush greenery, aspirational',
    section: 'Beautiful luxury living room interior, neutral tones, large windows, designer furniture, magazine quality',
    footer: 'Aerial view of an upscale residential neighborhood at golden hour, calm and aspirational',
  },
  event: {
    hero: 'Elegant wedding venue with romantic string lights, candles, white florals, golden hour light, cinematic atmosphere',
    section: 'Close-up of a beautifully styled table setting with candles, flowers, gold cutlery, soft bokeh',
    footer: 'Dreamy outdoor venue at twilight with fairy lights and lanterns, warm magical atmosphere',
  },
  generic: {
    hero: 'Bright modern workspace, plants, natural light, minimalist neutral tones, calm professional atmosphere',
    section: 'Close-up of a neutral textured surface with soft natural light, abstract minimalist',
    footer: 'Wide warm abstract background, soft natural tones, atmospheric',
  },
};

// "service" mete en el mismo saco limpieza, reformas, jardinería y fontanería, y una
// imagen de jardín no vende una reforma. La imagen siempre enseña el RESULTADO que el
// cliente compra, ya terminado y bonito — nunca obra a medias, terreno pelado o desorden.
const SERVICE_FLAVORS: Array<{ keys: string[]; hero: string; section: string; footer: string }> = [
  {
    keys: ['limpieza', 'cleaning', 'clean', 'fumigac', 'desinfec'],
    hero: 'Immaculate bright living room, spotless surfaces, everything perfectly tidy, sunlight streaming in, the feeling of a home just deep-cleaned',
    section: 'Spotless modern kitchen countertop gleaming in natural light, not a single item out of place',
    footer: 'Pristine tidy bedroom with crisp white linens, morning light, absolutely immaculate',
  },
  {
    keys: ['jardin', 'garden', 'landscap', 'paisaj', 'cesped', 'césped', 'poda'],
    hero: 'Beautiful landscaped backyard garden in full green health, manicured lawn, mature plants, stone path, golden hour light, lush and cared for',
    section: 'Close-up of a perfectly manicured green lawn edge meeting a flower bed, rich soil, healthy plants, morning dew',
    footer: 'Well-kept front garden of a home at golden hour, trimmed hedges, blooming flowers, welcoming',
  },
  {
    keys: ['reform', 'remodel', 'obra', 'construc', 'albañil', 'albanil', 'renovation'],
    hero: 'Stunning newly renovated open-plan kitchen and living space, brand new finishes, warm wood and stone, large windows, completely finished and styled',
    section: 'Beautifully renovated modern bathroom, new tiling, warm lighting, spa-like and completely finished',
    footer: 'Freshly renovated home exterior at golden hour, crisp finishes, modern and complete',
  },
  {
    keys: ['pintur', 'paint'],
    hero: 'Freshly painted bright interior wall in a warm neutral tone, crisp clean edges, sunlight, the room looking brand new',
    section: 'Close-up of a perfectly painted wall corner with crisp clean lines, soft natural light',
    footer: 'Freshly painted house facade in warm light, immaculate finish, vivid and clean',
  },
  {
    keys: ['fontaner', 'plumb', 'electric', 'climatiz', 'cerrajer', 'desatasc'],
    hero: 'Modern bathroom with brand new fixtures working perfectly, gleaming chrome, warm light, everything finished and immaculate',
    section: 'Close-up of new premium chrome fixtures and clean modern installation, soft light',
    footer: 'Bright well-maintained modern home interior, everything functioning and in order, warm evening light',
  },
  {
    keys: ['mudanz', 'moving', 'transport'],
    hero: 'Bright new home interior on moving day, neatly stacked labeled boxes, sunlight, calm and organized, the feeling of a smooth move',
    section: 'Neatly organized stack of moving boxes in a bright empty room with wooden floors',
    footer: 'Warm welcoming new home exterior at golden hour, keys-in-hand feeling',
  },
];

function serviceFlavor(businessName: string, category: string) {
  const haystack = `${category} ${businessName}`.toLowerCase();
  return SERVICE_FLAVORS.find(f => f.keys.some(k => haystack.includes(k))) ?? null;
}

function buildPrompt(
  slot: Slot,
  kind: BusinessKind,
  businessName: string,
  city: string | undefined,
  category: string,
): string {
  const flavor = kind === 'service' ? serviceFlavor(businessName, category) : null;
  const kp = flavor ?? KIND_PROMPTS[kind];
  const core = slot === 'hero' ? kp.hero : slot === 'ambient_section' ? kp.section : kp.footer;
  const cityHint = city ? ` Inspired by the vibe of ${city}.` : '';
  return `${core}.${cityHint} ${STYLE_BASE}`;
}

async function uploadGeneratedPhoto(
  base64: string,
  extractionId: string,
  slot: Slot,
): Promise<string | null> {
  try {
    const buffer = Buffer.from(base64, 'base64');
    const path = `${extractionId}/ai-${slot}.png`;
    const db = createAdminClient();
    const { error } = await db.storage
      .from('extractions')
      .upload(path, buffer, { contentType: 'image/png', upsert: true });
    if (error) {
      console.error('[generate] upload error:', error);
      return null;
    }
    const { data: { publicUrl } } = db.storage.from('extractions').getPublicUrl(path);
    return publicUrl;
  } catch (e) {
    console.error('[generate] upload exception:', e);
    return null;
  }
}

async function generateOne(
  client: OpenAI,
  slot: Slot,
  kind: BusinessKind,
  businessName: string,
  city: string | undefined,
  extractionId: string,
  category: string,
): Promise<PhotoMetadata | null> {
  try {
    const prompt = buildPrompt(slot, kind, businessName, city, category);
    const config = SLOT_CONFIG[slot];

    const result = await client.images.generate({
      model: 'gpt-image-1',
      prompt,
      size: config.size,
      quality: config.quality,
      n: 1,
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) return null;

    const url = await uploadGeneratedPhoto(b64, extractionId, slot);
    if (!url) return null;

    return {
      url,
      type: 'ambiente',
      quality: 'buena',
      heroCandidate: slot === 'hero',
      description: config.description,
      generated: true,
      slot,
    };
  } catch (e) {
    console.error(`[generate] error for slot ${slot}:`, e);
    return null;
  }
}

export async function generateAmbientPhotos(
  kind: BusinessKind,
  businessName: string,
  city: string | undefined,
  extractionId: string,
  category = '',
): Promise<PhotoMetadata[]> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[generate] OPENAI_API_KEY missing, skipping ambient generation');
    return [];
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const slots: Slot[] = ['hero', 'ambient_section', 'ambient_footer'];
  const results = await Promise.allSettled(
    slots.map(slot => generateOne(client, slot, kind, businessName, city, extractionId, category)),
  );

  return results
    .map(r => (r.status === 'fulfilled' ? r.value : null))
    .filter((m): m is PhotoMetadata => m !== null);
}
