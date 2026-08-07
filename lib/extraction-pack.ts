import type { PhotoMetadata, PhotoType } from './photo-classify';
import {
  inferBusinessKind, KIND_ART, FORBIDDEN_IMAGERY,
  pickTestimonials, collapseHours, curateRealPhotos, googleFontsHref,
  type BusinessKind,
} from './extraction-format';

// Lovable desaconseja el mega-prompt por escrito: "Small prompts compound. Big prompts
// collapse into changes you did not ask for and cannot untangle" y "one change per prompt".
// Este generador entrega lo mismo en el formato que sí quieren: un brief permanente para
// Project Knowledge (tope documentado 10.000 caracteres) y mensajes cortos que se encolan.

const KNOWLEDGE_LIMIT = 10_000;

interface BusinessLike {
  title?: string;
  subTitle?: string;
  description?: string;
  categoryName?: string;
  categories?: string[];
  address?: string;
  neighborhood?: string;
  city?: string;
  postalCode?: string;
  state?: string;
  countryCode?: string;
  website?: string;
  phone?: string;
  phoneUnformatted?: string;
  location?: { lat: number; lng: number };
  totalScore?: number;
  url?: string;
  reviewsCount?: number;
  reviewsDistribution?: Record<string, number>;
  openingHours?: Array<{ day: string; hours: string }>;
  additionalInfo?: Record<string, Array<Record<string, boolean>>>;
  reviewsTags?: Array<{ title: string; count: number }>;
}

interface ReviewLike {
  name?: string;
  stars?: number;
  text?: string | null;
  publishAt?: string;
  likesCount?: number;
  isLocalGuide?: boolean;
  reviewerNumberOfReviews?: number;
  curatedText?: string;
}

export interface PromptPack {
  /** Va en Project settings → Knowledge. Siempre en contexto. */
  knowledge: string;
  /** Se envían de uno en uno, en orden. Lovable los encola. */
  prompts: Array<{ n: number; title: string; body: string }>;
  readme: string;
}

export function generatePromptPack(
  business: BusinessLike,
  reviews: ReviewLike[],
  photoUrls: string[],
  photoMetadata?: PhotoMetadata[],
): PromptPack {
  const kind = inferBusinessKind(business);
  const art = KIND_ART[kind];
  const lang: 'es' | 'en' = ['US', 'GB', 'IE', 'AU', 'CA', 'NZ'].includes(business.countryCode ?? '') ? 'en' : 'es';
  const name = business.title ?? 'este negocio';
  const city = business.city ?? business.state ?? '';

  const hasMetadata = !!photoMetadata && photoMetadata.length > 0;
  const curated = hasMetadata ? curateRealPhotos(photoMetadata, 6) : [];
  const hero = hasMetadata
    ? curated.find(m => m.role === 'hero')
    : (photoUrls[0] ? ({ url: photoUrls[0], description: '', type: 'otro' as PhotoType } as PhotoMetadata) : undefined);
  const rest = hasMetadata
    ? curated.filter(m => m !== hero)
    : photoUrls.slice(1, 7).map(url => ({ url, description: '', type: 'otro' as PhotoType } as PhotoMetadata));

  const testimonials = pickTestimonials(reviews, business);
  const hasScore = typeof business.totalScore === 'number' && Number.isFinite(business.totalScore);
  const totalReviews = typeof business.reviewsCount === 'number' && Number.isFinite(business.reviewsCount)
    ? business.reviewsCount : null;
  const nReviews = totalReviews !== null ? totalReviews.toLocaleString('es-ES') : '';
  const badge = hasScore && totalReviews !== null && totalReviews >= 10
    ? `★ ${business.totalScore!.toFixed(1)} · ${nReviews} reseñas`
    : null;

  return {
    knowledge: buildKnowledge({ business, art, kind, lang, name, city, badge, hasScore, totalReviews, nReviews }),
    prompts: buildPrompts({ art, kind, name, hero, rest, testimonials, business, badge, city }),
    readme: buildReadme(name),
  };
}

// ---------------------------------------------------------------- knowledge

function buildKnowledge(ctx: {
  business: BusinessLike; art: typeof KIND_ART[BusinessKind]; kind: BusinessKind;
  lang: 'es' | 'en'; name: string; city: string; badge: string | null;
  hasScore: boolean; totalReviews: number | null; nReviews: string;
}): string {
  const { business, art, kind, lang, name, city, badge, hasScore, totalReviews, nReviews } = ctx;
  const L: string[] = [];
  const p = (...s: string[]) => { L.push(...s, ''); };

  p(`# ${name}`);
  p(
    `${business.categoryName ?? 'Negocio'}${city ? ` en ${city}` : ''}. ` +
    `Estamos construyendo su web nueva. Todo el contenido en ${lang === 'en' ? 'inglés' : 'español'}.`,
  );

  p('## Datos reales — lo que no esté aquí, no existe');
  const facts: string[] = [];
  if (business.address) facts.push(`- Dirección: ${business.address}`);
  if (business.phone) facts.push(`- Teléfono: ${business.phone} (botones con \`tel:${business.phoneUnformatted ?? business.phone}\`)`);
  if (business.url) facts.push(`- Ficha de Google Maps para "Cómo llegar": ${business.url}`);
  if (business.location) facts.push(`- Coordenadas del mapa: ${business.location.lat}, ${business.location.lng}`);
  if (business.categories && business.categories.length > 1) {
    facts.push(`- También es: ${business.categories.filter(c => c !== business.categoryName).join(', ')}`);
  }
  if (business.description) facts.push(`- Cómo se describe: ${business.description}`);
  p(...facts);
  // `business.website` se omite a propósito: es la web que esta sustituye.

  if (business.openingHours?.length) {
    p('### Horarios', ...collapseHours(business.openingHours, lang).map(h => `- ${h}`));
  }

  if (hasScore || totalReviews !== null) {
    const rep: string[] = ['### Valoración'];
    if (hasScore && totalReviews !== null) rep.push(`- ${business.totalScore!.toFixed(1)} sobre 5 con ${nReviews} reseñas. Son los números reales del negocio.`);
    else if (hasScore) rep.push(`- ${business.totalScore!.toFixed(1)} sobre 5.`);
    else rep.push(`- ${nReviews} reseñas.`);
    if (badge) rep.push(`- Va visible en la portada, junto al botón principal, así: \`${badge}\`.`);
    else if (totalReviews !== null) rep.push('- Son pocas: no la pongas en la portada, solo junto a los testimonios y sin el total.');
    p(...rep);
  }

  if (business.additionalInfo) {
    const infoLines: string[] = [];
    for (const [section, items] of Object.entries(business.additionalInfo)) {
      const flags = new Set<string>();
      for (const item of items) for (const [k, v] of Object.entries(item)) if (v === true) flags.add(k);
      if (flags.size > 0) infoLines.push(`- ${section}: ${[...flags].join(', ')}`);
    }
    if (infoLines.length) p('### Servicios y características declaradas', ...infoLines);
  }

  if (business.reviewsTags?.length) {
    p(
      '### Vocabulario',
      'Las palabras que repiten sus clientes. Úsalas al escribir, **sin decir de dónde salen**. Están en bruto: ignora las que no signifiquen nada fuera de contexto.',
      '',
      business.reviewsTags.slice(0, 10).map(t => t.title).join(' · '),
    );
  }

  p('## Dirección de arte');
  p(`Tono: ${art.vibe}`);
  p('```css', ':root {',
    `  --bg: ${art.bg}; --surface: ${art.surface}; --text: ${art.text};`,
    `  --muted: ${art.muted}; --primary: ${art.primary}; --accent: ${art.accent};`,
    '}', '```');
  p(`Tipografías: **${art.displayFont}** para títulos y **${art.bodyFont}** para texto.`);
  p('```html', `<link href="${googleFontsHref(art)}" rel="stylesheet">`, '```');
  p(
    `- \`border-radius: ${art.radius}\` en todo. Uno solo, coherente.`,
    '- 112px entre secciones en desktop, 72px en móvil.',
    '- Contenedor de 1152px centrado. Sombras casi invisibles o ninguna.',
    '- Mobile-first: compruébalo a 375px.',
    ...(art.dark ? ['- Fondo oscuro: bordes finos claros en vez de sombras, y cuidado con el contraste del texto secundario.'] : []),
  );
  p(
    '**Recursos de maqueta, para que no salga la plantilla de siempre — usa al menos tres:** ' +
    'numerar las secciones en el antetítulo (01, 02…), una banda a contracolor a media página, ' +
    'rejilla asimétrica 7/5 en vez de 50/50, una foto sangrando por un borde, un dato grande como ' +
    'elemento gráfico, un sello circular con la valoración.',
  );

  p('## Reglas de escritura');
  p(
    '- Párrafos de dos frases como mucho. Ningún bloque pasa de 60 palabras.',
    '- Concreto y de este negocio: si una frase valdría para cualquier competidor, no la escribas.',
    '- Relee cada frase preguntándote si un cliente podría leerla como una pega.',
    '- El titular grande de la portada es una promesa, no el nombre del negocio.',
  );

  p('## Prohibido');
  p(
    '1. **Publicar o enlazar cualquier web anterior del negocio.** Esta la sustituye. Si aparece una URL antigua en algún sitio, ignórala.',
    '2. **Ningún precio ni cifra en euros**, vengan de donde vengan. Los precios cambian y publicar uno viejo es un problema real.',
    '3. **No cites las reseñas ni a Google como fuente de un argumento** ("según nuestros clientes", "lo más mencionado"). El badge de valoración y los testimonios firmados sí van.',
    '4. **No inventes datos**: ni años, ni clientes, ni certificaciones, ni email, ni "desde 1998".',
    '5. **Ninguna imagen que no te haya dado yo.** Ni stock, ni generada, ni placeholders.',
    `6. **Nunca generes imágenes de ${FORBIDDEN_IMAGERY[kind]}.** Solo texturas abstractas, y solo cuando te lo pida.`,
    '7. Nada de lorem ipsum, secciones a medias ni enlaces que no lleven a ninguna parte.',
  );

  const out = L.join('\n');
  return out.length <= KNOWLEDGE_LIMIT ? out : `${out.slice(0, KNOWLEDGE_LIMIT - 40).trimEnd()}\n\n_(recortado)_`;
}

// ---------------------------------------------------------------- prompts

function photoLine(p: PhotoMetadata): string {
  const desc = p.description || 'foto del negocio';
  return `${p.url}\n  (${desc})`;
}

function buildPrompts(ctx: {
  art: typeof KIND_ART[BusinessKind]; kind: BusinessKind; name: string;
  hero?: PhotoMetadata; rest: PhotoMetadata[]; testimonials: ReturnType<typeof pickTestimonials>;
  business: BusinessLike; badge: string | null; city: string;
}): PromptPack['prompts'] {
  const { art, name, hero, rest, testimonials, business, badge, city } = ctx;
  const prompts: PromptPack['prompts'] = [];

  // 1 — el esqueleto y la portada. Un solo cambio: que exista la página y su portada.
  const p1: string[] = [
    `Haz una landing de una sola página para ${name}${city ? `, en ${city}` : ''}. Sigue la dirección de arte del Knowledge del proyecto al pie de la letra: esos colores, esas dos tipografías y ese radio, sin proponerme alternativas.`,
    '',
    'De momento monta solo tres cosas: el header, la portada y el pie.',
    '',
    `**Portada:** ${art.hero}`,
  ];
  if (hero) p1.push('', 'Usa esta foto y solo esta, es real del negocio:', `- ${photoLine(hero)}`);
  else p1.push('', 'No hay foto de portada que aguante. Resuélvela **sin foto de fondo**: titular grande, color de marca, el botón y la valoración. No metas ninguna imagen.');
  if (badge) p1.push('', `En la portada va la valoración así: \`${badge}\`.`);
  p1.push('', `Botón principal: "${art.cta}"${business.phone ? `, y que el de llamar sea \`tel:${business.phoneUnformatted ?? business.phone}\`` : ''}.`);
  prompts.push({ n: 1, title: 'Portada y sistema de diseño', body: p1.join('\n') });

  // 2 — el cuerpo. Las fotos van repartidas, no amontonadas en una galería.
  const middle = art.sections.filter(s => !/^\*\*Hero|Lo que dicen|Opiniones|Visítanos|Contacto|Contactar|Dónde estamos|Cómo llegar|Pedir presupuesto|Infórmate|Consultar|Reserva/i.test(s));
  const p2: string[] = [
    'Ahora añade el cuerpo de la página, debajo de la portada, con estas secciones en este orden:',
    '',
    ...middle.map((s, i) => `${i + 1}. ${s}`),
    '',
    'Escribe tú el copy con los datos del Knowledge. Nada de relleno.',
  ];
  if (rest.length > 0) {
    p2.push(
      '',
      `Tienes ${rest.length} ${rest.length === 1 ? 'foto real' : 'fotos reales'} del negocio para estas secciones. ` +
      '**Repártelas: una por sección, en este orden.** No las amontones en una galería, que deja el resto de la página como un muro de texto. ' +
      'Si sobran dos o más al final, esas sí van juntas.',
      '',
      ...rest.map((p, i) => `${i + 1}. ${photoLine(p)}`),
      '',
      'Ninguna sección de más de 60 palabras se queda sin imagen. Si te quedas sin fotos, resuelve las que falten con la banda a contracolor o un bloque de color — nunca con una imagen que no esté en esta lista.',
    );
  } else {
    p2.push('', 'No hay fotos usables de este negocio, así que estas secciones van sin imagen: resuélvelas con tipografía grande, color y la banda a contracolor. No metas stock ni placeholders.');
  }
  p2.push('', 'Al menos una de estas secciones va a contracolor, y al menos un bloque con rejilla asimétrica.');
  prompts.push({ n: 2, title: 'El cuerpo de la página', body: p2.join('\n') });

  // 3 — cierre: prueba social y la parte que convierte.
  const p3: string[] = [];
  if (testimonials.length > 0) {
    p3.push(
      `Añade la sección de testimonios con estos ${testimonials.length}, **literales, sin reescribir ni corregir la ortografía**. No añadas ninguno más ni te inventes ninguno:`,
      '',
      ...testimonials.flatMap(t => [`> "${t.text}"`, `> — ${t.name ?? 'Cliente'}${t.stars ? ` · ${'★'.repeat(t.stars)}` : ''}`, '']),
      'En tarjetas de la misma altura, en una fila en desktop y apiladas en móvil.',
      '',
    );
  }
  p3.push(
    'Y cierra la página con la sección de contacto, que tiene que cerrar la venta y no solo informar:',
    '',
    ...[
      business.phone ? `- El botón de llamar en \`tel:${business.phoneUnformatted ?? business.phone}\`` : null,
      business.address ? `- La dirección y el mapa de Google incrustado${business.location ? ` con las coordenadas ${business.location.lat}, ${business.location.lng}` : ''}` : null,
      business.openingHours?.length ? '- Los horarios del Knowledge, legibles en móvil' : null,
      '- Un formulario corto de tres campos (nombre, teléfono, qué necesita) que al enviar diga algo claro',
    ].filter(Boolean) as string[],
    '',
    `Y en el \`<head>\`: \`<title>\` con "${name}${business.categoryName ? ` – ${business.categoryName}` : ''}${city ? ` en ${city}` : ''}", una meta description de 150-160 caracteres, y un \`<script type="application/ld+json">\` con schema.org/LocalBusiness usando los datos reales.`,
  );
  prompts.push({ n: 3, title: 'Testimonios, contacto y SEO', body: p3.join('\n') });

  // 4 — opcional y al final: es el único punto donde generar imágenes no es un riesgo.
  prompts.push({
    n: 4,
    title: 'Texturas (opcional, solo si la página pide aire)',
    body: [
      'Si alguna sección se ve vacía, genera imágenes **abstractas** para darle textura: un patrón sutil de fondo, un degradado con grano, una forma orgánica en el color de acento o una textura de papel. Siempre por debajo del contenido, sin robar protagonismo.',
      '',
      `**Nunca generes imágenes de ${FORBIDDEN_IMAGERY[ctx.kind]}.** Esta web solo puede enseñar fotos reales del negocio; una imagen generada de algo que no existe es publicidad engañosa.`,
    ].join('\n'),
  });

  return prompts;
}

function buildReadme(name: string): string {
  return [
    `# Cómo usar este ZIP para la web de ${name}`,
    '',
    'Está preparado para Lovable, que trabaja mejor con mensajes cortos que con un texto largo.',
    'Son cinco minutos:',
    '',
    '1. Crea un proyecto nuevo en Lovable.',
    '2. Ve a **Project settings → Knowledge** y pega ahí el contenido de `knowledge.md`.',
    '   Eso queda siempre en contexto: los datos del negocio, los colores y lo que no debe hacer.',
    '3. Vuelve al chat y pega **`prompt-1.md`**. Espera a que termine.',
    '4. Pega **`prompt-2.md`**, y luego **`prompt-3.md`**. Puedes pegarlos seguidos sin esperar:',
    '   Lovable los pone en cola y los ejecuta en orden.',
    '5. `prompt-4.md` es opcional: solo si la página se te ve vacía y quieres texturas de fondo.',
    '',
    'Si prefieres pegarlo todo de una vez, usa `prompt-completo.md`. Funciona, pero el resultado',
    'suele ser peor: Lovable recomienda mensajes pequeños y un cambio por mensaje.',
    '',
    '## Lo demás',
    '',
    '- `data.json` — todos los datos del negocio en bruto',
    '- `reviews.md` — todas las reseñas. Material de consulta, no un menú: los testimonios',
    '  que van en la web son los del `prompt-3.md`, ya elegidos y filtrados',
    '- `images/` — las fotos descargadas',
  ].join('\n');
}
