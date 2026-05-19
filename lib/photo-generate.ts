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
    size: '1024x1024',
    quality: 'low',
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
  service: {
    hero: 'Professional service team in clean uniforms working in a modern home interior, sunlight, sense of trust and competence',
    section: 'Spotlessly clean modern kitchen, natural sunlight streaming through window, immaculate surfaces',
    footer: 'Aerial view of a tidy suburban neighborhood at golden hour, soft warm tones',
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

function buildPrompt(slot: Slot, kind: BusinessKind, businessName: string, city?: string): string {
  const kp = KIND_PROMPTS[kind];
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
): Promise<PhotoMetadata | null> {
  try {
    const prompt = buildPrompt(slot, kind, businessName, city);
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
): Promise<PhotoMetadata[]> {
  if (!process.env.OPENAI_API_KEY) {
    console.warn('[generate] OPENAI_API_KEY missing, skipping ambient generation');
    return [];
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const slots: Slot[] = ['hero', 'ambient_section', 'ambient_footer'];
  const results = await Promise.allSettled(
    slots.map(slot => generateOne(client, slot, kind, businessName, city, extractionId)),
  );

  return results
    .map(r => (r.status === 'fulfilled' ? r.value : null))
    .filter((m): m is PhotoMetadata => m !== null);
}
