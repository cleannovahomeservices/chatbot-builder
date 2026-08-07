import { effectiveScore } from './photo-classify';
import type { PhotoMetadata, PhotoType } from './photo-classify';
import { checkTestimonial, isPublishable, trimToSentence } from './review-hygiene';

interface BusinessData {
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
  plusCode?: string;
  totalScore?: number;
  placeId?: string;
  url?: string;
  reviewsCount?: number;
  reviewsDistribution?: Record<string, number>;
  imagesCount?: number;
  openingHours?: Array<{ day: string; hours: string }>;
  permanentlyClosed?: boolean;
  temporarilyClosed?: boolean;
  additionalInfo?: Record<string, Array<Record<string, boolean>>>;
  reviewsTags?: Array<{ title: string; count: number }>;
}

interface ReviewData {
  name?: string;
  stars?: number;
  text?: string | null;
  publishedAtDate?: string;
  publishAt?: string;
  likesCount?: number;
  isLocalGuide?: boolean;
  reviewerNumberOfReviews?: number;
  responseFromOwnerText?: string | null;
  responseFromOwnerDate?: string | null;
  /** Texto elegido por el pase de curación (`lib/review-filter`), ya recortado. */
  curatedText?: string;
}

export type BusinessKind =
  | 'food'        // restaurante, café, bar, panadería
  | 'lodging'    // hotel, casa rural, hostal, apartamento turístico
  | 'beauty'     // peluquería, barbería, salón de uñas, spa, estética
  | 'service'    // limpieza, fontanería, electricista, reformas, mudanzas
  | 'fitness'    // gimnasio, yoga, pilates, crossfit
  | 'health'     // clínica, dentista, fisio, veterinario, óptica
  | 'retail'     // tienda, boutique, librería, floristería
  | 'auto'       // taller, lavadero, concesionario
  | 'education'  // academia, escuela, autoescuela
  | 'realestate' // inmobiliaria, agencia
  | 'event'      // sala, salón de bodas, fotógrafo
  | 'generic';

export function inferBusinessKind(business: BusinessData): BusinessKind {
  const haystack = [
    business.categoryName ?? '',
    ...(business.categories ?? []),
    business.title ?? '',
    business.subTitle ?? '',
  ]
    .join(' ')
    .toLowerCase();

  const has = (...keys: string[]) => keys.some(k => haystack.includes(k));

  if (has('restaurant', 'restaurante', 'café', 'cafe', 'cafetería', 'cafeteria', 'bar ', 'pizzer', 'panader', 'bakery', 'tapas', 'asador', 'parrilla', 'sushi', 'food', 'comida', 'heladería', 'heladeria', 'pastelería', 'pasteleria', 'brasserie', 'bistro', 'pub', 'cervecería', 'cerveceria')) return 'food';
  if (has('hotel', 'hostal', 'hostel', 'lodging', 'apartamento turístico', 'apartamento turistico', 'casa rural', 'b&b', 'pensión', 'pension', 'resort', 'cottage', 'alojamiento')) return 'lodging';
  if (has('hair', 'peluquer', 'barber', 'nail', 'uñas', 'unas', 'spa', 'estética', 'estetica', 'beauty', 'belleza', 'salon de belleza', 'salón de belleza', 'depilac', 'masaj')) return 'beauty';
  if (has('cleaning', 'limpieza', 'plumb', 'fontaner', 'electric', 'electricista', 'reform', 'mudanz', 'moving', 'pest', 'jardiner', 'pintur', 'cerrajer', 'climatiz', 'fumigac', 'desatasc')) return 'service';
  if (has('gym', 'gimnasio', 'fitness', 'yoga', 'pilates', 'crossfit', 'box', 'martial', 'artes marciales', 'training', 'entrenamiento')) return 'fitness';
  if (has('dentist', 'dentista', 'clinic', 'clínica', 'clinica', 'doctor', 'medic', 'physiother', 'fisioter', 'veterinari', 'pediatr', 'psicólog', 'psicologo', 'óptic', 'optic', 'podólog', 'podologo')) return 'health';
  if (has('boutique', 'tienda', 'store', 'shop', 'libreria', 'librería', 'florist', 'jewelry', 'joyer', 'mercer', 'zapater', 'ropa', 'moda', 'fashion', 'supermarket')) return 'retail';
  if (has('taller', 'mecánico', 'mecanico', 'workshop', 'autorepair', 'lavadero de coches', 'car wash', 'concesionario', 'neumáticos', 'neumaticos', 'auto')) return 'auto';
  if (has('school', 'escuela', 'academ', 'autoescuela', 'driving school', 'training center', 'instituto', 'university', 'universidad', 'guarder')) return 'education';
  if (has('real estate', 'inmobiliaria', 'real-estate', 'agencia inmobiliaria', 'agente inmobiliario')) return 'realestate';
  if (has('wedding', 'boda', 'event venue', 'sala de eventos', 'fotógraf', 'fotograf', 'photograph', 'catering')) return 'event';

  return 'generic';
}

// Una dirección de arte concreta —con hex y tipografías con nombre— da mejor resultado
// que describir una sensación ("cálido y acogedor"), y de paso se salta el paso de
// "Design guidance" de Lovable, que si no rellena él con su estilo por defecto.
interface ArtDirection {
  /** En una frase: qué tiene que sentir quien entra. */
  vibe: string;
  bg: string;
  surface: string;
  text: string;
  muted: string;
  primary: string;
  accent: string;
  /** true si el fondo es oscuro: cambia cómo se tratan overlays y sombras. */
  dark?: boolean;
  displayFont: string;
  bodyFont: string;
  radius: string;
  hero: string;
  cta: string;
  /** Secciones de la página, con lo que va dentro de cada una. */
  sections: string[];
}

const KIND_ART: Record<BusinessKind, ArtDirection> = {
  food: {
    vibe: 'Apetitoso y cálido, de sitio al que vuelves. Nada corporativo.',
    bg: '#FBF7F1', surface: '#F3EADF', text: '#1C1614', muted: '#6B5B4F',
    primary: '#B4472A', accent: '#C9A227',
    displayFont: 'Fraunces', bodyFont: 'Inter', radius: '14px',
    hero: 'A pantalla completa con la foto de portada de fondo, overlay oscuro al 45% y el nombre del negocio en display grande. Debajo: una frase de qué se come aquí, el badge de valoración y el botón de llamar.',
    cta: 'Reservar mesa',
    sections: [
      '**Hero** — nombre, una frase, valoración de Google, botón de llamar',
      '**Qué se come aquí** — dos párrafos sobre la cocina y el sitio, con una foto al lado',
      '**Especialidades** — 4-6 cards de los platos o categorías que aparecen en los datos, con nombre y una línea. Sin precios',
      '**Galería** — las fotos de la sección de fotos, mismo aspect-ratio',
      '**Lo que dicen** — los testimonios en cards de igual altura',
      '**Visítanos** — dirección, mapa incrustado, horarios, teléfono',
    ],
  },
  lodging: {
    vibe: 'Sereno y luminoso, de escapada apetecible. Mucho aire.',
    bg: '#FAF8F5', surface: '#EFEAE3', text: '#2A2724', muted: '#736C63',
    primary: '#3F5A4A', accent: '#C4A882',
    displayFont: 'DM Serif Display', bodyFont: 'Inter', radius: '10px',
    hero: 'Foto de portada a ancho completo sin overlay o con uno muy ligero (20%), título en serif y una línea de ubicación. Botón "Consultar disponibilidad" y, debajo, el badge de valoración.',
    cta: 'Consultar disponibilidad',
    sections: [
      '**Hero** — nombre, ubicación en una línea, valoración, CTA',
      '**El alojamiento** — qué es y para quién, con las comodidades declaradas como lista de iconos',
      '**Galería** — las fotos, en grid uniforme',
      '**La zona** — qué hay alrededor, usando la ciudad y el barrio reales',
      '**Opiniones de huéspedes** — los testimonios',
      '**Cómo llegar y reservar** — dirección, mapa, horarios de check-in si constan, teléfono',
    ],
  },
  beauty: {
    vibe: 'Editorial y cuidado, como una revista. Fotografía grande y tipografía fina.',
    bg: '#FDF9F7', surface: '#F6ECE9', text: '#241C1E', muted: '#7A6A6D',
    primary: '#B07C86', accent: '#BFA36F',
    displayFont: 'Italiana', bodyFont: 'Jost', radius: '4px',
    hero: 'Dividido 55/45: a la izquierda el nombre en display, una frase y el botón de reservar; a la derecha la foto de portada en vertical (aspect-ratio 4:5) sin recortar la cara si la hay.',
    cta: 'Reservar cita',
    sections: [
      '**Hero** — nombre, frase, CTA de reserva, foto vertical',
      '**Servicios** — lista limpia con nombre y una línea cada uno, sacada de las categorías y de lo que mencionan los clientes. Sin precios',
      '**Nuestros trabajos** — las fotos en grid 1:1',
      '**Lo que dicen** — los testimonios',
      '**Reserva** — teléfono, dirección, horarios, mapa',
    ],
  },
  service: {
    vibe: 'Profesional y directo. Que en tres segundos se entienda qué hace y cómo llamarle.',
    bg: '#FFFFFF', surface: '#F4F6F8', text: '#0F172A', muted: '#5B6472',
    primary: '#1D4ED8', accent: '#16A34A',
    displayFont: 'Manrope', bodyFont: 'Inter', radius: '10px',
    hero: 'Sin foto de fondo: titular grande a la izquierda con el servicio y la ciudad, subtítulo con el beneficio concreto, teléfono en grande como botón y un botón de presupuesto. A la derecha, la foto de portada en un bloque con esquinas redondeadas.',
    cta: 'Pedir presupuesto',
    sections: [
      '**Hero** — qué servicio y dónde, teléfono grande, CTA',
      '**Servicios** — cards con icono (Lucide) y una línea cada uno. Sin fotos dentro de las cards',
      '**Cómo trabajamos** — 3 o 4 pasos numerados, del contacto al trabajo terminado',
      '**Trabajos realizados** — las fotos, con un pie corto cada una',
      '**Lo que dicen** — los testimonios',
      '**Zona de trabajo** — la ciudad y las localidades cercanas, con el mapa',
      '**Pedir presupuesto** — formulario corto (nombre, teléfono, qué necesita) y el teléfono otra vez',
    ],
  },
  fitness: {
    vibe: 'Energía y contraste. Fondo oscuro, un acento que grita, tipografía maciza.',
    bg: '#0B0B0C', surface: '#17171A', text: '#F5F5F4', muted: '#A1A1A6',
    primary: '#D7FF3E', accent: '#FF5A1F', dark: true,
    displayFont: 'Bricolage Grotesque', bodyFont: 'Inter', radius: '6px',
    hero: 'Pantalla completa con la foto de portada de fondo, overlay negro al 55% y titular en mayúsculas muy grande. CTA en el color de acento, que destaque sobre el negro.',
    cta: 'Prueba una clase',
    sections: [
      '**Hero** — titular en mayúsculas, una frase, CTA en acento',
      '**Qué se entrena aquí** — las disciplinas o servicios en cards con icono',
      '**Las instalaciones** — las fotos, en grid 16:9',
      '**Horarios** — la tabla de horarios, legible en móvil',
      '**Lo que dicen** — los testimonios sobre fondo de superficie',
      '**Dónde estamos** — dirección, mapa, teléfono',
    ],
  },
  health: {
    vibe: 'Limpio y tranquilizador. Mucho blanco, cero estridencias, todo legible.',
    bg: '#FFFFFF', surface: '#F1F7F9', text: '#122A33', muted: '#5A727C',
    primary: '#0E7490', accent: '#3BAFA0',
    displayFont: 'DM Sans', bodyFont: 'Inter', radius: '12px',
    hero: 'Sin foto de fondo: titular centrado o a la izquierda con la especialidad y la ciudad, subtítulo que explique qué se trata, botón de pedir cita y teléfono. La foto de portada va al lado, en un bloque contenido, nunca a sangre.',
    cta: 'Pedir cita',
    sections: [
      '**Hero** — especialidad y ciudad, CTA de cita, teléfono',
      '**Tratamientos** — cards con icono y una línea cada uno',
      '**El centro** — las fotos, pocas y grandes',
      '**Lo que dicen los pacientes** — los testimonios',
      '**Primera visita** — qué llevar, cómo pedir cita, horarios',
      '**Dónde estamos** — dirección, mapa, teléfono, accesibilidad si consta',
    ],
  },
  retail: {
    vibe: 'Lookbook. El producto grande y el resto callado.',
    bg: '#FFFFFF', surface: '#F5F4F2', text: '#1A1A1A', muted: '#6E6E6E',
    primary: '#1A1A1A', accent: '#A85B3A',
    displayFont: 'Instrument Serif', bodyFont: 'Inter', radius: '4px',
    hero: 'Foto de portada grande con el nombre superpuesto abajo a la izquierda en display, o al lado si la foto no aguanta texto encima. Un solo CTA.',
    cta: 'Visítanos',
    sections: [
      '**Hero** — nombre, una frase de qué se vende, CTA',
      '**Qué vendemos** — las categorías reales del negocio, en cards sobrias',
      '**La tienda** — las fotos, en grid uniforme',
      '**Lo que dicen** — los testimonios',
      '**Visítanos** — dirección, mapa, horarios, teléfono',
    ],
  },
  auto: {
    vibe: 'Técnico y sólido. Oscuro, con un acento de señalización.',
    bg: '#101214', surface: '#1A1D21', text: '#F2F4F6', muted: '#9AA3AC',
    primary: '#E4572E', accent: '#F5C518', dark: true,
    displayFont: 'Oswald', bodyFont: 'Inter', radius: '4px',
    hero: 'Foto de portada de fondo con overlay al 60%, titular condensado con el servicio y la ciudad, teléfono grande como botón principal.',
    cta: 'Pedir cita',
    sections: [
      '**Hero** — servicio y ciudad, teléfono grande',
      '**Servicios** — cards con icono, sin fotos dentro',
      '**El taller** — las fotos',
      '**Lo que dicen** — los testimonios',
      '**Horarios y ubicación** — tabla de horarios, mapa, teléfono',
    ],
  },
  education: {
    vibe: 'Cercano y claro. Que dé confianza a quien decide por otro.',
    bg: '#FFFFFF', surface: '#F4F7FE', text: '#15213B', muted: '#5C6880',
    primary: '#2451B8', accent: '#F2A73B',
    displayFont: 'Poppins', bodyFont: 'Inter', radius: '14px',
    hero: 'Sin foto de fondo: titular con lo que se aprende y dónde, subtítulo con el beneficio, CTA de información y la foto de portada al lado en un bloque redondeado.',
    cta: 'Pide información',
    sections: [
      '**Hero** — qué se aprende y dónde, CTA',
      '**Cursos** — cards con nombre y una línea',
      '**Cómo enseñamos** — 3 puntos con icono',
      '**El centro** — las fotos',
      '**Lo que dicen** — los testimonios',
      '**Infórmate** — formulario corto, teléfono, dirección, horarios, mapa',
    ],
  },
  realestate: {
    vibe: 'Sobrio y premium. Serif, mucho blanco, nada de degradados.',
    bg: '#FAF9F7', surface: '#F0EDE8', text: '#1B1A18', muted: '#6C665C',
    primary: '#1B1A18', accent: '#8C7A5B',
    displayFont: 'Cormorant Garamond', bodyFont: 'Inter', radius: '2px',
    hero: 'Foto de portada a ancho completo con el nombre en serif encima, overlay al 30%. Debajo, una barra con el teléfono y el CTA.',
    cta: 'Contactar',
    sections: [
      '**Hero** — nombre, zona en la que trabajan, CTA',
      '**Qué hacemos** — comprar, vender, alquilar o lo que digan los datos, en tres bloques',
      '**Quiénes somos** — las fotos y un párrafo con los años y la zona',
      '**Lo que dicen** — los testimonios',
      '**Contacto** — teléfono, dirección, horarios, mapa',
    ],
  },
  event: {
    vibe: 'Emotivo y cinematográfico. Fotos grandes, texto escaso, elegancia.',
    bg: '#FAF7F2', surface: '#F0E9DE', text: '#171310', muted: '#6F6459',
    primary: '#171310', accent: '#B99B6B',
    displayFont: 'Playfair Display', bodyFont: 'Inter', radius: '0px',
    hero: 'Pantalla completa con la foto de portada, overlay al 35% y el nombre en display muy grande centrado. Un solo CTA debajo.',
    cta: 'Consultar disponibilidad',
    sections: [
      '**Hero** — nombre, una frase, CTA',
      '**El espacio / el servicio** — dos párrafos con lo que incluye',
      '**Galería** — las fotos, lo más grandes posible',
      '**Lo que dicen** — los testimonios',
      '**Consultar** — formulario corto, teléfono, dirección, mapa',
    ],
  },
  generic: {
    vibe: 'Limpio y profesional, sin personalidad prestada.',
    bg: '#FFFFFF', surface: '#F5F6F7', text: '#14181C', muted: '#5D666E',
    primary: '#1F2937', accent: '#2563EB',
    displayFont: 'Manrope', bodyFont: 'Inter', radius: '12px',
    hero: 'Titular con qué hace el negocio y dónde, subtítulo con el beneficio, CTA y teléfono. La foto de portada al lado o de fondo con overlay, según aguante.',
    cta: 'Contactar',
    sections: [
      '**Hero** — qué hace el negocio y dónde, CTA',
      '**Qué hacemos** — cards con icono y una línea',
      '**Galería** — las fotos',
      '**Lo que dicen** — los testimonios',
      '**Contacto** — teléfono, dirección, horarios, mapa',
    ],
  },
};

// Ordenar por estrellas y cortar por longitud mínima deja pasar el "Muy bien, repetiré"
// de cinco estrellas, que como testimonio no dice nada. Lo que hace bueno a un testimonio
// es que sea concreto: que nombre el servicio, el problema resuelto o a la persona.
function scoreReview(r: ReviewData, topics: string[]): number {
  const text = r.text ?? '';
  let score = 0;

  // Longitud, con techo: a partir de ~400 caracteres deja de sumar y empieza a ser un ladrillo.
  score += Math.min(text.length, 400) / 10;

  // Concreción: menciona temas que otros clientes también destacan.
  const lower = text.toLowerCase();
  score += topics.filter(t => lower.includes(t)).length * 12;

  // Señales de que la reseña es de alguien real y le sirvió a otros.
  score += Math.min(r.likesCount ?? 0, 10) * 3;
  if (r.isLocalGuide) score += 5;
  if ((r.reviewerNumberOfReviews ?? 0) >= 5) score += 4;
  if (r.responseFromOwnerText) score += 4;

  // 5 estrellas por delante de 4, pero sin que una de 5 vacía gane a una de 4 detallada.
  score += (r.stars ?? 0) * 4;

  // Los signos de exclamación en cadena y el todo-mayúsculas quedan mal maquetados.
  if (/!{2,}/.test(text)) score -= 8;
  if (text.length > 20 && text === text.toUpperCase()) score -= 15;

  return score;
}

/** Un testimonio listo para publicar: el texto ya recortado y de quién es. */
interface Testimonial {
  text: string;
  name?: string;
  stars?: number;
  publishAt?: string;
}

const MAX_TESTIMONIALS = 3;

/**
 * Los testimonios los elige el pase de `review-filter` durante la extracción. Aquí se
 * respeta esa decisión y solo se completa si eligió menos de la cuenta o si la
 * extracción es anterior a que existiera el pase.
 *
 * En los dos caminos pasa el filtro de higiene: la reseña con un "pero" en la última
 * frase o con un precio de hace dos años no se publica la elija quien la elija.
 */
function pickTestimonials(reviews: ReviewData[], business: BusinessData): Testimonial[] {
  const topics = (business.reviewsTags ?? [])
    .slice(0, 10)
    .map(t => t.title.toLowerCase())
    .filter(t => t.length > 3);

  const chosen: Testimonial[] = [];
  const openings = new Set<string>();

  const add = (r: ReviewData, text: string): boolean => {
    const opening = text.toLowerCase().replace(/[^a-záéíóúñ ]/g, '').trim().slice(0, 25);
    if (openings.has(opening)) return false;
    openings.add(opening);
    chosen.push({ text, name: r.name, stars: r.stars, publishAt: r.publishAt });
    return chosen.length >= MAX_TESTIMONIALS;
  };

  for (const r of reviews) {
    const curated = r.curatedText?.trim();
    if (curated && checkTestimonial(curated).ok && add(r, curated)) return chosen;
  }
  if (chosen.length >= MAX_TESTIMONIALS) return chosen;

  // Respaldo: ordenar por concreción y quedarnos con las que pasan la higiene.
  const ordered = reviews
    .filter(r => (r.stars ?? 0) >= 4 && r.text && !r.curatedText)
    .sort((a, b) => scoreReview(b, topics) - scoreReview(a, topics));

  for (const r of ordered) {
    if (!checkTestimonial(r.text).ok) continue;
    if (add(r, trimToSentence(r.text!))) return chosen;
  }
  if (chosen.length > 0) return chosen;

  // Nada pasó el filtro estricto. Antes que quedarnos sin prueba social, se relaja a
  // "sin importes" — lo único que es un problema de verdad si se publica.
  for (const r of ordered) {
    if (!isPublishable(r.text)) continue;
    if (add(r, trimToSentence(r.text!))) break;
  }
  return chosen;
}

const DAY_JOINERS = {
  es: { range: ' a ', pair: ' y ' },
  en: { range: ' to ', pair: ' & ' },
} as const;

const HOUR_RANGE_RE = /(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?\s+to\s+(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?/gi;

/**
 * Apify devuelve los horarios en inglés y en 12 horas ("1 to 4:30 PM") aunque se le
 * pida el sitio en español. Publicado tal cual en la web de un negocio español canta
 * muchísimo, así que se pasan a 24 horas. Si el formato no encaja, se deja intacto.
 */
function normalizeHours(raw: string, lang: 'es' | 'en'): string {
  if (lang !== 'es') return raw;
  if (/^closed$/i.test(raw.trim())) return 'Cerrado';
  if (/open 24 ?hours/i.test(raw)) return 'Abierto 24 h';

  return raw.replace(HOUR_RANGE_RE, (whole, h1, m1, ap1, h2, m2, ap2) => {
    // "1 to 4:30 PM": el meridiano del final vale para los dos extremos.
    const from = to24(h1, m1, ap1 ?? ap2);
    const to = to24(h2, m2, ap2 ?? ap1);
    return from && to ? `${from}–${to}` : whole;
  });
}

function to24(hour: string, minutes: string | undefined, meridiem: string | undefined): string | null {
  let h = Number(hour);
  if (!Number.isInteger(h) || h < 1 || h > 24) return null;
  if (meridiem) {
    const pm = meridiem.toUpperCase() === 'PM';
    if (h === 12) h = pm ? 12 : 0;
    else if (pm) h += 12;
  }
  return `${String(h).padStart(2, '0')}:${minutes ?? '00'}`;
}

/**
 * "Lunes: 13-16, Martes: 13-16, Miércoles: 13-16…" ocupa siete líneas y se lee fatal.
 * Los días seguidos con el mismo horario se colapsan en uno.
 */
function collapseHours(hours: Array<{ day: string; hours: string }>, lang: 'es' | 'en'): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < hours.length) {
    let j = i;
    while (j + 1 < hours.length && hours[j + 1].hours === hours[i].hours) j++;
    const span = j - i;
    const joiner = DAY_JOINERS[lang];
    const label =
      span === 0 ? hours[i].day
      : span === 1 ? `${hours[i].day}${joiner.pair}${hours[j].day}`
      : `${hours[i].day}${joiner.range}${hours[j].day}`;
    const capitalized = label.charAt(0).toUpperCase() + label.slice(1);
    out.push(`${capitalized}: ${normalizeHours(hours[i].hours, lang)}`);
    i = j + 1;
  }
  return out;
}

interface PhotoGroup {
  type: PhotoType;
  title: string;
  guidance: string;
  photos: PhotoMetadata[];
}

const TYPE_GUIDANCE: Record<PhotoType, { title: string; guidance: string; priority: number }> = {
  exterior: {
    title: '🚪 Exterior / Fachada',
    guidance: 'Encajan en "Visítanos" o "Cómo llegar", junto a la dirección y el mapa: ayudan a reconocer el sitio al llegar.',
    priority: 1,
  },
  interior: {
    title: '🏠 Interior del local',
    guidance: 'Sección "El espacio" / "Sobre el lugar". Dales tamaño: si el negocio se vende por su ambiente, una foto pequeña del interior no cuenta nada.',
    priority: 2,
  },
  producto: {
    title: '🍽 Productos / Platos',
    guidance: 'Grid tipo catálogo o "Menú destacado". Para restaurantes: galería masonry. Para tiendas: cards con aspect-ratio uniforme.',
    priority: 3,
  },
  trabajo_terminado: {
    title: '✅ Trabajos realizados (PRUEBA SOCIAL)',
    guidance: 'Sección "Trabajos realizados" / "Resultados" / "Antes-después". Son la prueba de que el negocio funciona. Caption breve en cada una. NO mezclar con fotos del local.',
    priority: 2,
  },
  equipo: {
    title: '👥 Equipo / Personas',
    guidance: 'Sección "Quiénes somos" o "Conoce al equipo". Aspect-ratio 1:1 o 4:5. Humaniza el negocio.',
    priority: 4,
  },
  ambiente: {
    title: '🎨 Ambiente / Detalles',
    guidance: 'Como acentos visuales en transiciones de sección o complementando fotos principales. NO las uses solas — siempre como apoyo.',
    priority: 5,
  },
  menu: {
    title: '📋 Carta / Lista de precios',
    guidance: 'NO mostrar la foto de la carta en la web. En su lugar, **extrae los textos visibles y maquétalos** como una sección de precios/servicios real. La carta fotografiada queda fea.',
    priority: 6,
  },
  vehiculo: {
    title: '🚐 Vehículos / Flota',
    guidance: 'Solo si el negocio depende de desplazarse (servicios a domicilio, mudanzas, mensajería). Sección "Trabajamos en toda la zona" o footer.',
    priority: 7,
  },
  logo: {
    title: '🔖 Logo',
    guidance: '**NO usar como decoración** en el cuerpo de la web. Solo el favicon, el header y el footer si encaja. Si es la única foto disponible, déjala en blanco con un placeholder.',
    priority: 8,
  },
  otro: {
    title: '📷 Otras',
    guidance: 'Galería extendida con lightbox al final. Solo si todavía aportan.',
    priority: 9,
  },
};

function groupPhotosByType(metadata: PhotoMetadata[]): PhotoGroup[] {
  const buckets = new Map<PhotoType, PhotoMetadata[]>();
  for (const m of metadata) {
    if (!buckets.has(m.type)) buckets.set(m.type, []);
    buckets.get(m.type)!.push(m);
  }
  const groups: PhotoGroup[] = [];
  for (const [type, photos] of buckets) {
    const g = TYPE_GUIDANCE[type];
    groups.push({ type, title: g.title, guidance: g.guidance, photos });
  }
  groups.sort((a, b) => TYPE_GUIDANCE[a.type].priority - TYPE_GUIDANCE[b.type].priority);
  return groups;
}

// Curaduría extrema: máximo 6 fotos reales, solo las buenas, priorizando por tipo y heroCandidate
const REAL_TYPE_PRIORITY: Record<PhotoType, number> = {
  trabajo_terminado: 10,
  producto: 9,
  equipo: 8,
  interior: 7,
  exterior: 6,
  ambiente: 4,
  vehiculo: 3,
  menu: 2,
  otro: 1,
  logo: 0,
};

function curateRealPhotos(metadata: PhotoMetadata[], maxCount = 6): PhotoMetadata[] {
  const real = metadata.filter(m => !m.generated);

  // Si pasó el ranking comparativo, esa decisión manda: ya se tomó viendo todas las
  // fotos juntas, que es información que aquí no tenemos.
  const ranked = real.filter(m => m.role === 'hero' || m.role === 'destacada');
  if (ranked.length > 0) {
    return ranked
      .slice()
      .sort((a, b) => {
        if ((a.role === 'hero') !== (b.role === 'hero')) return a.role === 'hero' ? -1 : 1;
        return 0;
      })
      .slice(0, maxCount);
  }
  // Si nadie asignó papel (extracciones antiguas, o el ranking falló), ordena por lo que haya.
  if (real.some(m => m.role === 'descartada')) return [];

  return real
    .filter(m => m.quality === 'buena')
    .slice()
    .sort((a, b) => {
      if (a.heroCandidate !== b.heroCandidate) return a.heroCandidate ? -1 : 1;
      const byScore = effectiveScore(b) - effectiveScore(a);
      if (byScore !== 0) return byScore;
      return REAL_TYPE_PRIORITY[b.type] - REAL_TYPE_PRIORITY[a.type];
    })
    .slice(0, maxCount);
}

// Pesos disponibles en Google Fonts por familia. Pedir un peso que la fuente no tiene
// devuelve un 400 y la web se queda sin tipografía; las que solo traen regular van vacías.
const DISPLAY_WEIGHTS: Record<string, string> = {
  'Fraunces': '400;600;700',
  'DM Serif Display': '',
  'Italiana': '',
  'Manrope': '400;600;800',
  'Bricolage Grotesque': '400;700;800',
  'DM Sans': '400;500;700',
  'Instrument Serif': '',
  'Oswald': '400;600;700',
  'Poppins': '400;600;700',
  'Cormorant Garamond': '400;600;700',
  'Playfair Display': '400;600;800',
};

function googleFontsHref(art: ArtDirection): string {
  const fam = (name: string, weights: string) =>
    `family=${name.replace(/ /g, '+')}${weights ? `:wght@${weights}` : ''}`;
  const display = fam(art.displayFont, DISPLAY_WEIGHTS[art.displayFont] ?? '');
  const body = fam(art.bodyFont, '400;500;600');
  return `https://fonts.googleapis.com/css2?${display}&${body}&display=swap`;
}

/** Lo que se generaría de más está prohibido; el ejemplo cambia según el negocio. */
const FORBIDDEN_IMAGERY: Record<BusinessKind, string> = {
  food: 'platos, el local o clientes',
  lodging: 'habitaciones, el edificio o el entorno',
  beauty: 'trabajos, el salón o personas',
  service: 'trabajos terminados, herramientas en uso o el equipo',
  fitness: 'el gimnasio, el material o gente entrenando',
  health: 'la consulta, el equipamiento o el personal',
  retail: 'productos, el escaparate o la tienda',
  auto: 'el taller, coches o mecánicos',
  education: 'aulas, alumnos o profesores',
  realestate: 'propiedades, la oficina o el equipo',
  event: 'el espacio, celebraciones o personas',
  generic: 'el negocio, sus productos o sus instalaciones',
};

export function generatePromptMd(
  business: BusinessData,
  reviews: ReviewData[],
  photoUrls: string[],
  photoMetadata?: PhotoMetadata[],
): string {
  const kind = inferBusinessKind(business);
  const art = KIND_ART[kind];
  const lang: 'es' | 'en' = ['US', 'GB', 'IE', 'AU', 'CA', 'NZ'].includes(business.countryCode ?? '') ? 'en' : 'es';
  const name = business.title ?? 'este negocio';
  const city = business.city ?? business.state ?? '';

  // Con metadata mandan los puestos que asignó el pase comparativo; sin ella
  // (extracciones anteriores a agosto de 2026) se cae al orden en que llegaron.
  const hasMetadata = !!photoMetadata && photoMetadata.length > 0;
  const curated = hasMetadata ? curateRealPhotos(photoMetadata!, 6) : [];
  const heroPhoto = hasMetadata
    ? curated.find(m => m.role === 'hero')
    : (photoUrls[0] ? { url: photoUrls[0], description: '', type: 'otro' as PhotoType } as PhotoMetadata : undefined);
  const galleryPhotos = hasMetadata
    ? curated.filter(m => m !== heroPhoto)
    : photoUrls.slice(1, 7).map(url => ({ url, description: '', type: 'otro' as PhotoType } as PhotoMetadata));
  const anyPhotos = !!heroPhoto || galleryPhotos.length > 0;

  const testimonials = pickTestimonials(reviews, business);

  const lines: string[] = [];
  const p = (...s: string[]) => { lines.push(...s, ''); };

  p(`# Web para ${name}`);
  p('Pega este mensaje entero en Lovable, v0, Bolt, Cursor o Claude y empieza a construir. Está todo aquí: los datos son reales, las fotos ya están elegidas con su puesto y la dirección de arte está decidida. No hace falta preguntar nada antes de empezar.');

  // ========== 1. EL ENCARGO ==========
  p('## 1. El encargo');
  p(
    `Una **landing de una sola página** para **${name}**${business.categoryName ? `, ${business.categoryName.toLowerCase()}` : ''}${city ? ` en ${city}` : ''}. ` +
    `Todo el contenido en **${lang === 'en' ? 'inglés' : 'español'}**.`,
  );
  p(
    `El objetivo de la página es que quien entre acabe ${business.phone ? 'llamando por teléfono' : 'contactando'}. ` +
    'Todo lo demás está al servicio de eso.',
  );
  p(
    '**El copy lo escribes tú**, con los datos reales de la sección 6. Concreto y de este negocio: si una frase valdría igual para cualquier competidor, no la escribas. ' +
    'Mal: "Ofrecemos un servicio de calidad". Bien: algo que solo pueda decir este negocio, con su nombre, su ciudad y lo que hace de verdad.',
  );
  p(
    '- **Párrafos de dos frases como mucho.** Ningún bloque pasa de 60 palabras: en el móvil no se lee, se salta.',
    '- **Relee cada frase preguntándote si un cliente podría leerla como una pega.** Explicar por qué algo está bien acaba nombrando el defecto que quieres negar, y lo único que se queda el lector es el defecto.',
    `- Escribe el nombre del negocio como se escribe: **${name}**.`,
  );

  // ========== 2. DIRECCIÓN DE ARTE ==========
  p('## 2. Dirección de arte (ya decidida — úsala tal cual)');
  p(`**El tono:** ${art.vibe}`);
  p('**Paleta.** Defínelos como variables CSS y no uses ningún color fuera de esta lista:');
  p(
    '```css',
    ':root {',
    `  --bg: ${art.bg};        /* fondo de la página */`,
    `  --surface: ${art.surface};   /* tarjetas y secciones alternas */`,
    `  --text: ${art.text};      /* texto principal */`,
    `  --muted: ${art.muted};     /* texto secundario */`,
    `  --primary: ${art.primary};   /* botones y enlaces */`,
    `  --accent: ${art.accent};    /* iconos, subrayados, detalles */`,
    '}',
    '```',
  );
  if (art.dark) {
    p('Es un diseño de fondo oscuro: cuida el contraste del texto secundario y usa bordes finos claros en vez de sombras, que sobre negro no se ven.');
  }
  p('**Tipografías.** Cárgalas de Google Fonts con este link exacto:');
  p('```html', `<link href="${googleFontsHref(art)}" rel="stylesheet">`, '```');
  p(
    `- Títulos: **${art.displayFont}**`,
    `- Texto: **${art.bodyFont}**`,
    '- Escala: hero 64-96px en desktop y 40-56px en móvil, h2 36-48px, h3 24-28px, cuerpo 17px con line-height 1.6',
  );
  p('**Formas y ritmo.**');
  p(
    `- \`border-radius: ${art.radius}\` en todo: tarjetas, botones e imágenes. Uno solo, coherente.`,
    '- Aire entre secciones: 112px en desktop, 72px en móvil. Que respire.',
    '- Contenedor de 1152px centrado con padding lateral de 24px. El hero puede ir a sangre.',
    '- Sombras casi invisibles o ninguna: mejor un borde de 1px que una sombra pesada.',
    '- Animación: fade-up de 20px al entrar en viewport, 600ms, una sola vez. Nada más.',
    '- Mobile-first de verdad: compruébalo a 375px antes de darlo por hecho.',
  );
  p(`**Hero:** ${art.hero}`);
  p(
    '**El titular grande del hero es una promesa, no el nombre del negocio.** El nombre ya va en el logo, en el `<title>` y en el pie; ' +
    'gastar el tamaño de letra más grande de la página en repetirlo desperdicia lo único que va a leer todo el mundo. ' +
    `Pon "${name}" encima, pequeño, como antetítulo, y usa el titular para decir qué se lleva quien entre.`,
  );
  p(
    '**Recursos de maqueta — usa al menos tres.** Sin esto la página sale como el apilado de secciones de siempre, ' +
    'y eso es exactamente lo que hay que evitar:',
  );
  p(
    '- **Numera las secciones** en el antetítulo (`01`, `02`, `03`…) con la tipografía de títulos y en el color de acento.',
    '- **Una banda a contracolor** a media página: una sección entera con el fondo en `--text` o `--primary` y el texto invertido, para romper el ritmo.',
    '- **Rejilla asimétrica** en los bloques de dos columnas: 7/5 o 8/4, nunca 50/50.',
    '- **Una foto sangrando por un borde** de la pantalla, sin margen a ese lado.',
    '- **Un dato grande** en tipografía de títulos a tamaño de titular (la valoración, los años, el número de reseñas) como elemento gráfico, no como texto corrido.',
    '- **Un sello circular** o una etiqueta rotada con la valoración, encima de una foto.',
  );
  p(
    `**CTA principal:** "${art.cta}", arriba y al final de la página.` +
    (business.phone ? ` El botón de llamar usa \`tel:${business.phoneUnformatted ?? business.phone}\` para que en móvil marque directamente.` : ''),
  );

  // ========== 3. LA PÁGINA ==========
  p('## 3. La página, sección por sección');
  const sections = art.sections.filter(s => testimonials.length > 0 || !/Lo que dicen|Opiniones/.test(s));

  // Google declara para qué público es el sitio ("Ideal para ir con niños", "Grupos").
  // Es lo más cercano a segmentación que tenemos, y una página sin ella se queda en folleto.
  const audience = Object.keys(business.additionalInfo ?? {})
    .filter(k => /p[úu]blico|menores|ni[ñn]os|grupos|ambiente/i.test(k));
  if (audience.length > 0) {
    const at = sections.findIndex(s => /Lo que dicen|Opiniones/.test(s));
    const extra = '**Para quién es este sitio** — tres perfiles reales sacados de las características declaradas en la sección 6, en tres bloques cortos con icono. Nada de inventarse públicos que los datos no respalden';
    sections.splice(at >= 0 ? at : sections.length - 1, 0, extra);
  }
  for (const [i, s] of sections.entries()) p(`${i + 1}. ${s}`);
  p('Ese es el orden y no hay más secciones. Si un dato que pide una sección no está en la sección 6, esa parte no se pone — no se rellena con nada.');
  p('Ese orden es el esqueleto, no la maqueta: **al menos una de estas secciones va a contracolor y al menos una lleva la foto sangrando por un borde.** Si las montas todas igual, con su título centrado y su párrafo debajo, la página sale como cualquier plantilla por muy buenos que sean los colores.');
  p(
    `**La última sección tiene que cerrar la venta**, no solo informar: ${business.phone ? 'el botón de llamar en `tel:`, ' : ''}` +
    'el enlace de "Cómo llegar" al mapa y un formulario corto de tres campos (nombre, teléfono, qué necesita). ' +
    'Una página que acaba en un mapa y un horario deja al visitante sin nada que hacer.',
  );
  p(
    `Además, en el \`<head>\`: \`<title>\` con \`${name}${business.categoryName ? ` – ${business.categoryName}` : ''}${city ? ` en ${city}` : ''}\`, ` +
    'una meta description de 150-160 caracteres con el beneficio y la ciudad, y un `<script type="application/ld+json">` con schema.org/LocalBusiness usando los datos reales de la sección 6.',
  );

  // ========== 4. FOTOS ==========
  p('## 4. Fotos');
  if (!anyPhotos) {
    p('**Este negocio no tiene ni una foto usable, así que la web va sin fotos.** Se puede hacer muy bien: tipografía grande y con carácter, el sistema de color de la sección 2 llevado al extremo, mucho espacio en blanco, iconos de Lucide para los servicios, y la valoración y los testimonios como protagonistas visuales.');
    p('**No rellenes el hueco.** Ni banco de imágenes, ni ilustraciones genéricas, ni imágenes generadas, ni placeholders grises. Una web honesta sin fotos da más confianza que una llena de fotos que obviamente no son de este negocio. Al final del todo, sugiere al dueño qué 5-8 fotos debería hacer.');
  } else {
    p('Todas son fotos reales del negocio, ya filtradas: quitamos las repetidas, las flojas y las que rompían la coherencia del conjunto. **Cada una tiene un puesto asignado. Úsala ahí y en ningún otro sitio.** Las URLs son permanentes, sirven con `<img>` o `next/image`.');

    if (heroPhoto) {
      p('**PORTADA:**');
      p(
        `- ${heroPhoto.url}`,
        `  - _${heroPhoto.description || 'foto del negocio'}_`,
        ...(heroPhoto.roleReason ? [`  - Elegida porque: ${heroPhoto.roleReason}`] : []),
      );
    } else if (galleryPhotos.length > 0) {
      p('**Sin foto de portada.** Ninguna aguanta un hero a pantalla completa. Resuelve la portada **sin foto de fondo**: titular grande, el color de marca, el CTA y la valoración. Queda mejor que estirar una foto mediocre.');
    }

    if (galleryPhotos.length > 0) {
      p(
        `**REPARTIDAS POR LA PÁGINA — ${galleryPhotos.length} ${galleryPhotos.length === 1 ? 'foto' : 'fotos'}, en este orden.** ` +
        'No las amontones todas en una galería: eso deja el resto de la página como un muro de texto. ' +
        'Ve colocándolas de arriba abajo, una por sección, según van apareciendo las secciones de la sección 3. ' +
        'Si al final sobran dos o más, esas sí van juntas como cierre visual antes del contacto.',
      );
      for (const [i, ph] of galleryPhotos.entries()) {
        lines.push(`${i + 1}. ${ph.url}`);
        lines.push(`   - _${ph.description || 'foto del negocio'}_${ph.type && ph.type !== 'otro' ? ` (${ph.type})` : ''}`);
        if (ph.roleReason) lines.push(`   - Elegida porque: ${ph.roleReason}`);
      }
      lines.push('');
      if (galleryPhotos.length < 3) {
        p('⚠️ Son menos de tres: **no hagas un grid con ellas**, quedaría vacío. Intégralas sueltas como acento dentro del contenido.');
      }
    }

    if (hasMetadata && curated.length > 0) {
      p('**Cómo tratar cada tipo:**');
      for (const group of groupPhotosByType(curated)) lines.push(`- **${group.title}** — ${group.guidance}`);
      lines.push('');
    }

    p(
      '- **Ninguna sección de más de 60 palabras se queda sin imagen.** Si te quedas sin fotos antes que sin secciones, resuelve las que falten con la banda a contracolor, un dato grande o un bloque de color — nunca con una imagen que no esté en esta lista.',
      '- Vienen de móviles y años distintos: mismo `aspect-ratio`, `object-fit: cover`, mismo radio y misma sombra en todas las que caigan en el mismo grid. Un filtro sutil y uniforme (`filter: saturate(0.92) contrast(1.02)`) ayuda a que parezcan de la misma sesión — compruébalo y quítalo si las afea.',
      '- `loading="lazy"` en todas menos la de portada. `alt` descriptivo con el nombre del negocio.',
      '- Lightbox solo si hay más de cuatro juntas.',
    );
  }

  // ========== 5. TESTIMONIOS ==========
  if (testimonials.length > 0) {
    p(`## 5. Testimonios (${testimonials.length}, ya elegidos)`);
    p(`Usa **estos ${testimonials.length} y solo estos**. Ya están filtrados: elogios limpios, concretos y sin nada que pueda envejecer mal. **Pégalos literalmente, sin reescribir ni corregir la ortografía** — una reseña con una falta parece real, una pulida parece inventada.`);
    for (const t of testimonials) {
      lines.push(`> "${t.text}"`);
      lines.push(`> — **${t.name ?? 'Cliente'}**${t.stars ? ` · ${'★'.repeat(t.stars)}` : ''}`);
      lines.push('');
    }
    p('Van en tarjetas de altura uniforme (`items-stretch`), en una fila en desktop y apiladas en móvil.');
  }

  // ========== 6. DATOS ==========
  p('## 6. Datos del negocio');
  p('_Todo lo de aquí es real y verificado. Lo que no esté aquí, no existe: no lo inventes ni lo deduzcas._');

  const facts: string[] = [];
  if (business.title) facts.push(`- **Nombre:** ${business.title}`);
  if (business.subTitle) facts.push(`- **Subtítulo:** ${business.subTitle}`);
  if (business.categoryName) facts.push(`- **Categoría:** ${business.categoryName}`);
  if (business.categories && business.categories.length > 1) {
    facts.push(`- **También es:** ${business.categories.filter(c => c !== business.categoryName).join(', ')}`);
  }
  if (business.description) facts.push(`- **Cómo se describe el negocio:** ${business.description}`);
  if (facts.length > 0) p(...facts);

  const contact: string[] = ['### Contacto'];
  if (business.address) contact.push(`- **Dirección:** ${business.address}`);
  if (business.neighborhood) contact.push(`- **Barrio:** ${business.neighborhood}`);
  if (business.city) contact.push(`- **Ciudad:** ${business.city}`);
  if (business.postalCode) contact.push(`- **CP:** ${business.postalCode}`);
  if (business.state) contact.push(`- **Provincia:** ${business.state}`);
  if (business.phone) contact.push(`- **Teléfono:** ${business.phone} _(en los botones: \`tel:${business.phoneUnformatted ?? business.phone}\`)_`);
  if (business.url) contact.push(`- **Ficha de Google Maps:** ${business.url} _(para el enlace "Cómo llegar")_`);
  if (business.location) contact.push(`- **Coordenadas:** ${business.location.lat}, ${business.location.lng} _(para incrustar el mapa)_`);
  if (contact.length > 1) p(...contact);
  // `business.website` se omite a propósito: es la web que esta sustituye. Publicarla
  // manda al visitante a la página vieja, que es exactamente lo que el cliente paga por dejar atrás.

  if (business.openingHours && business.openingHours.length > 0) {
    p('### Horarios', ...collapseHours(business.openingHours, lang).map(h => `- ${h}`));
  }

  const hasScore = typeof business.totalScore === 'number' && Number.isFinite(business.totalScore);
  const totalReviews = typeof business.reviewsCount === 'number' && Number.isFinite(business.reviewsCount)
    ? business.reviewsCount
    : null;
  const nReviews = totalReviews !== null ? totalReviews.toLocaleString('es-ES') : '';

  if (hasScore || totalReviews !== null) {
    const rep: string[] = ['### Valoración'];
    if (hasScore && totalReviews !== null) {
      rep.push(`- **${business.totalScore!.toFixed(1)} sobre 5 con ${nReviews} reseñas.** Son los números reales y completos del negocio.`);
    } else if (hasScore) {
      rep.push(`- **${business.totalScore!.toFixed(1)} sobre 5.**`);
    } else {
      rep.push(`- **${nReviews} reseñas.**`);
    }
    if (business.reviewsDistribution) {
      const dist = business.reviewsDistribution;
      const five = Number(dist.fiveStar ?? dist['5'] ?? 0);
      const four = Number(dist.fourStar ?? dist['4'] ?? 0);
      const sum = Object.values(dist).reduce((a, b) => a + (Number(b) || 0), 0);
      if (sum > 0 && Number.isFinite(five)) {
        const pctFive = Math.round((five / sum) * 100);
        rep.push(`- El ${pctFive}% son de cinco estrellas y el ${Math.round(((five + four) / sum) * 100)}% de cuatro o cinco.`);
      }
    }
    if (hasScore && totalReviews !== null && totalReviews >= 10) {
      rep.push(`- **Va visible en el hero**, junto al CTA, así: \`★ ${business.totalScore!.toFixed(1)} · ${nReviews} reseñas\`. Es la prueba más creíble que tiene este negocio; no la escondas en el pie.`);
    } else if (totalReviews !== null && totalReviews < 10) {
      rep.push('- **Son pocas: no pongas el contador en el hero.** Un "3 reseñas" resta. Deja la valoración solo junto a los testimonios y sin el total.');
    }
    p(...rep);
  }

  if (business.reviewsTags && business.reviewsTags.length > 0) {
    p(
      '### Vocabulario del negocio',
      '_Las palabras que más repiten sus clientes. Úsalas al escribir el copy para que suene a este negocio, **sin decir de dónde salen**. Están sacadas en bruto: ignora las que no signifiquen nada fuera de contexto._',
      '',
      business.reviewsTags.slice(0, 10).map(t => t.title).join(' · '),
    );
  }

  if (business.additionalInfo) {
    const infoLines: string[] = [];
    for (const [section, items] of Object.entries(business.additionalInfo)) {
      // Google repite la misma característica en varias entradas del mismo bloque.
      const flags = new Set<string>();
      for (const item of items) {
        for (const [key, value] of Object.entries(item)) {
          if (value === true) flags.add(key);
        }
      }
      if (flags.size > 0) infoLines.push(`- **${section}:** ${[...flags].join(', ')}`);
    }
    if (infoLines.length > 0) {
      p('### Servicios y características declaradas', '_Material de primera para las cards de servicios y para los iconos._', '', ...infoLines);
    }
  }

  // ========== 7. PROHIBIDO ==========
  p('## 7. Prohibido');
  p('Cada punto de esta lista es un fallo que ya ha arruinado una web generada así:');
  p(
    '- **No publiques ni enlaces ninguna web anterior del negocio.** Esta la sustituye. Si te encuentras una URL antigua en algún dato, ignórala. Los únicos enlaces externos son el mapa de Google y las redes sociales si constan.',
    '- **Ningún precio, ni una cifra en euros.** Ni de los datos, ni sacado de una reseña, ni inventado. Los precios cambian y publicar uno viejo es un problema real para el dueño. Habla de servicios, no de tarifas.',
    '- **No cites las reseñas ni a Google como fuente de un argumento.** Nada de "según nuestros clientes", "lo más mencionado en las reseñas" o "los usuarios destacan". El badge de valoración y los testimonios firmados sí van: esos son la prueba, no una cita.',
    '- **No inventes datos.** Ni años de experiencia, ni número de clientes, ni certificaciones, ni premios, ni un email, ni "desde 1998". Si no está en la sección 6, no existe.',
    `- **Ninguna imagen que no esté en la sección 4.** Ni de banco de imágenes, ni generada, ni placeholders, ni iconos usados como si fueran fotos.${anyPhotos ? '' : ' Esta web va sin fotos y así se queda.'}`,
    '- **Ningún testimonio que no esté en la sección 5**, y ninguno reescrito.',
    '- **Nada de lorem ipsum**, secciones a medias, "próximamente" ni enlaces que no lleven a ninguna parte.',
    '- **Ningún formulario mudo.** Si montas uno, que al enviar diga algo claro y deje el teléfono a mano.',
  );

  // ========== 8. SEGUNDO MENSAJE ==========
  p('## 8. Cuando la web esté montada (esto es para después)');
  p(
    'Termina primero la web entera con lo de arriba y dime que has acabado. **Solo entonces**, si hace falta textura, puedes generar imágenes **abstractas**: un patrón sutil de fondo, un degradado con grano, una forma orgánica en el color de acento, una textura de papel. Siempre por debajo del contenido y sin robar protagonismo.',
  );
  p(`**Nunca generes imágenes de ${FORBIDDEN_IMAGERY[kind]}.** Esta web solo puede enseñar fotos reales de este negocio; una imagen generada de algo que no existe es publicidad engañosa y el dueño responde por ella.`);

  // ========== CIERRE ==========
  p('---');
  p(
    '**Qué más hay en el ZIP:** `data.json` con todos los datos en bruto, `reviews.md` con todas las reseñas y `images/` con las fotos descargadas. ' +
    '`reviews.md` es material de consulta, **no un menú**: los testimonios que van en la web son los de la sección 5.',
  );

  return lines.join('\n');
}
export function generateReviewsMd(reviews: ReviewData[], businessTitle?: string): string {
  const lines: string[] = [];
  lines.push(`# Todas las reseñas de ${businessTitle ?? 'este negocio'}`);
  lines.push('');
  lines.push(`Total: ${reviews.length} reseñas extraídas`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const r of reviews) {
    lines.push(`### ${r.name ?? 'Anónimo'} — ${'★'.repeat(r.stars ?? 0)}${'☆'.repeat(5 - (r.stars ?? 0))}`);
    if (r.publishAt || r.publishedAtDate) {
      lines.push(`*${r.publishAt ?? r.publishedAtDate}*`);
    }
    if (r.isLocalGuide) {
      lines.push(`*Local Guide${r.reviewerNumberOfReviews ? ` · ${r.reviewerNumberOfReviews} reseñas` : ''}*`);
    }
    lines.push('');
    if (r.text) {
      lines.push(r.text);
      lines.push('');
    } else {
      lines.push('*(Sin texto)*');
      lines.push('');
    }
    if (r.responseFromOwnerText) {
      lines.push(`**Respuesta del propietario:**`);
      lines.push(`> ${r.responseFromOwnerText.replace(/\n/g, '\n> ')}`);
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}
