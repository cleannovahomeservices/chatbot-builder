import type { PhotoMetadata, PhotoType } from './photo-classify';

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
}

type BusinessKind =
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

function inferBusinessKind(business: BusinessData): BusinessKind {
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

const KIND_STRATEGY: Record<BusinessKind, {
  vibe: string;
  palette: string;
  heroLayout: string;
  photoStrategy: string;
  primarySections: string[];
  ctaPrimary: string;
}> = {
  food: {
    vibe: 'Apetitoso, cálido y acogedor. Las fotos son producto: tienen que abrir boca.',
    palette: 'Cálidos y tierra: terracota, mostaza, oliva, crema. Acentos en negro o burdeos. Evita azules fríos.',
    heroLayout: 'Hero a pantalla completa con UNA foto del plato/local más fotogénico de fondo (con overlay oscuro 40%) y un título tipo serif elegante. CTA grande: "Reservar mesa".',
    photoStrategy: 'Las fotos son protagonistas. Distribúyelas así: 1 como hero background, 6-9 en un grid masonry estilo Instagram en la sección "El menú en imágenes" o "Nuestra cocina", y las restantes en una galería con lightbox al final. NUNCA pongas fotos sueltas en medio del texto.',
    primarySections: ['Hero', 'Sobre el lugar (1 párrafo + 1-2 fotos)', 'Menú destacado / Especialidades', 'Galería visual (masonry)', 'Reseñas', 'Reserva / Contacto', 'Horarios + Mapa'],
    ctaPrimary: 'Reservar mesa / Llamar',
  },
  lodging: {
    vibe: 'Aspiracional, sereno y luminoso. Estilo Airbnb/Booking moderno.',
    palette: 'Neutros premium: blanco hueso, beige, gris piedra, verde salvia. Acentos en madera natural. Tipografía serif para el branding.',
    heroLayout: 'Hero full-width con la foto más impresionante del alojamiento (exterior o estancia principal). Sin overlay o muy ligero. Título grande, descripción corta, dos CTAs: "Ver disponibilidad" + "Galería".',
    photoStrategy: 'Galería tipo Airbnb: 1 foto grande a la izquierda + 4 fotos en grid 2x2 a la derecha en el hero/inicio, con botón "Ver todas". Después secciones temáticas: "El alojamiento", "La zona", "Comodidades", cada una con 1-3 fotos integradas al contenido. Lightbox completo con todas las fotos al final.',
    primarySections: ['Hero con galería Airbnb', 'Sobre el alojamiento', 'Galería completa', 'Comodidades / Servicios', 'Entorno y actividades cercanas', 'Reseñas de huéspedes', 'Disponibilidad / Reserva', 'Ubicación'],
    ctaPrimary: 'Ver disponibilidad / Reservar',
  },
  beauty: {
    vibe: 'Refinado, femenino, "instagrameable". Estilo editorial.',
    palette: 'Rosados empolvados, nudes, dorado champagne, blanco crema, negro. Tipografía sans-serif fina + un display serif.',
    heroLayout: 'Hero dividido 60/40: a la izquierda título + claim + CTA "Reservar cita", a la derecha foto cuadrada/vertical del trabajo más destacado o del salón.',
    photoStrategy: 'Las fotos son "trabajos realizados" → trátalas como portfolio. Sección "Nuestros trabajos" con grid 3 columnas (2 en móvil), aspect-ratio 1:1, hover sutil con zoom. NO mezcles fotos del local con fotos de trabajos: si las hay, ponlas en "Nuestro espacio" aparte.',
    primarySections: ['Hero', 'Servicios + precios', 'Nuestros trabajos (galería grid)', 'Nuestro espacio (1-3 fotos integradas)', 'Reseñas', 'Reservar online', 'Contacto + horarios'],
    ctaPrimary: 'Reservar cita',
  },
  service: {
    vibe: 'Profesional, confiable, directo. Las fotos son PRUEBA SOCIAL de resultados, no decoración.',
    palette: 'Azules y grises corporativos (#0A66C2 tipo LinkedIn, #1F2937, blanco). Acento en verde o amarillo para "confianza". Tipografía sans-serif sólida (Inter, Manrope).',
    heroLayout: 'Hero con título claro tipo "X servicios en [ciudad] desde [año]", subtítulo con beneficio concreto, CTA "Pide presupuesto gratis" + teléfono visible grande. A la derecha: UNA foto del trabajo más representativo terminado, NO una foto cualquiera.',
    photoStrategy: 'Las fotos suelen ser de trabajos terminados → úsalas como PRUEBA. Sección "Trabajos realizados" o "Antes / Después" con grid de 6-8 fotos máximo, cada una con caption corto ("Limpieza de oficina 200m², Madrid, mayo 2025"). NO pongas más de 8 fotos en la página principal — el resto van en una galería aparte o en una página /trabajos. NUNCA fotos sueltas decorando el texto.',
    primarySections: ['Hero con teléfono visible', 'Servicios (cards con icono, NO fotos)', 'Cómo trabajamos (3-4 pasos)', 'Trabajos realizados (galería curada)', 'Reseñas verificadas de Google', 'Zona de servicio + ciudades', 'Pedir presupuesto (form simple)'],
    ctaPrimary: 'Pedir presupuesto gratis',
  },
  fitness: {
    vibe: 'Energético, motivacional, con movimiento.',
    palette: 'Negro + un acento vibrante (lima, naranja, magenta, eléctrico). Alto contraste. Tipografía bold condensada para títulos.',
    heroLayout: 'Hero full-bleed con foto del espacio en acción (gente entrenando si la hay) + overlay oscuro. Título grande mayúsculas, CTA "Primera clase gratis" o "Apúntate".',
    photoStrategy: 'Fotos del espacio y equipamiento → integrarlas como background de secciones (con overlay) y en una sección "Las instalaciones" con grid. Si hay fotos de clases/gente → úsalas para sección "La comunidad". Aspect-ratio cinematográfico (16:9 o 21:9).',
    primarySections: ['Hero', 'Clases / Disciplinas', 'Las instalaciones', 'Horarios', 'Planes y precios', 'Reseñas', 'Prueba gratis'],
    ctaPrimary: 'Apúntate / Prueba gratis',
  },
  health: {
    vibe: 'Profesional, limpio, confiable. Estilo clínica privada moderna.',
    palette: 'Blanco + azul suave o verde menta. Mucho espacio en blanco. Tipografía sans-serif clara (Inter, DM Sans).',
    heroLayout: 'Hero limpio: título centrado o a la izquierda, subtítulo explicativo, CTA "Pedir cita" + teléfono. Foto del equipo médico o de la consulta a la derecha o de fondo con mucha luz.',
    photoStrategy: 'Pocas fotos, bien elegidas. 1 foto del equipo/consulta en hero, 2-3 fotos integradas en "Nuestro centro" o "Tecnología y equipamiento". NO uses fotos como decoración: cada foto debe ilustrar un punto concreto (el equipo, una tecnología, el espacio).',
    primarySections: ['Hero', 'Tratamientos / Especialidades (cards)', 'Nuestro equipo', 'El centro (2-3 fotos)', 'Reseñas de pacientes', 'Primera visita / Cómo pedir cita', 'Ubicación + horarios'],
    ctaPrimary: 'Pedir cita',
  },
  retail: {
    vibe: 'Cuidado, "lookbook", muestra el producto con dignidad.',
    palette: 'Depende del producto, pero apuesta por neutros con un acento de la marca. Mucho espacio en blanco.',
    heroLayout: 'Hero con UN producto/escaparate destacado a tamaño grande + título + CTA "Ver tienda" o "Visítanos".',
    photoStrategy: 'Trata las fotos como catálogo: grid 3-4 columnas con aspect-ratio uniforme. Si hay fotos del local úsalas para "Visita la tienda" en sección aparte. NO mezcles producto y local.',
    primarySections: ['Hero', 'Productos destacados (grid)', 'Sobre la tienda', 'Visítanos (foto del local + dirección)', 'Reseñas', 'Contacto + horarios'],
    ctaPrimary: 'Visítanos / Ver productos',
  },
  auto: {
    vibe: 'Técnico, masculino, eficiente. Que transmita "saben lo que hacen".',
    palette: 'Grafito, negro, rojo o naranja de acento. Tipografía industrial/técnica.',
    heroLayout: 'Hero con foto del taller en acción + título tipo "Mecánica de confianza en [ciudad]" + CTA "Pedir cita" + teléfono.',
    photoStrategy: 'Fotos del taller, equipamiento y trabajos → sección "El taller" con 3-4 fotos + sección "Trabajos / Especialidades" con grid de tipos de servicios y foto representativa.',
    primarySections: ['Hero', 'Servicios (cards con icono)', 'El taller (galería)', 'Marcas y especialidades', 'Reseñas', 'Pedir cita / Presupuesto', 'Ubicación + horarios'],
    ctaPrimary: 'Pedir cita / Llamar',
  },
  education: {
    vibe: 'Cercano, motivador, profesional.',
    palette: 'Azul confiable + un acento cálido (amarillo, coral). Tipografía amigable.',
    heroLayout: 'Hero con título sobre resultados/promesa + CTA "Infórmate" + foto del aula o de alumnos en clase.',
    photoStrategy: 'Fotos del centro y de actividades → integrarlas en "Las instalaciones" (grid 2-3 cols) y "Nuestra metodología" (1-2 fotos contextuales).',
    primarySections: ['Hero', 'Cursos / Programas', 'Metodología', 'Las instalaciones', 'Profesorado', 'Testimonios de alumnos', 'Pide información'],
    ctaPrimary: 'Pide información',
  },
  realestate: {
    vibe: 'Premium, confiable, cercano al lujo según zona.',
    palette: 'Negro/grafito + dorado o blanco hueso + verde oliva. Tipografía serif para títulos.',
    heroLayout: 'Hero full-width con foto de una propiedad o de la oficina premium + título + CTA "Ver propiedades" o "Contactar".',
    photoStrategy: 'Fotos de la oficina/equipo en sección "Quiénes somos". Si las fotos son de propiedades, NO mezclar con foto de oficina — separar claramente.',
    primarySections: ['Hero', 'Servicios (comprar / vender / alquilar)', 'Quiénes somos + equipo', 'Reseñas de clientes', 'Contacto'],
    ctaPrimary: 'Contactar',
  },
  event: {
    vibe: 'Aspiracional, emotivo, cinematográfico.',
    palette: 'Neutros elegantes: negro, blanco hueso, dorado, nude. Tipografía serif display.',
    heroLayout: 'Hero a pantalla completa con la foto más emotiva/cinematográfica + título tipo display + CTA "Consultar disponibilidad".',
    photoStrategy: 'Las fotos son el corazón. Galería grande tipo masonry o slideshow full-bleed. "Galería de momentos" con 12-20 fotos.',
    primarySections: ['Hero cinematográfico', 'Sobre el espacio/servicio', 'Galería masonry', 'Servicios incluidos', 'Reseñas', 'Consultar disponibilidad'],
    ctaPrimary: 'Consultar disponibilidad',
  },
  generic: {
    vibe: 'Profesional y limpio, adaptable al sector.',
    palette: 'Decide colores que encajen con el sector. Mantén buena legibilidad y jerarquía.',
    heroLayout: 'Hero con título claro de qué hace el negocio + subtítulo de beneficio + CTA principal + foto de apoyo.',
    photoStrategy: 'Curate las fotos: 1 para hero, 4-6 mejores en una galería principal con grid, el resto en una galería extendida con lightbox. NO pongas fotos sueltas decorando texto.',
    primarySections: ['Hero', 'Qué hacemos / Servicios', 'Galería', 'Reseñas', 'Contacto + horarios + mapa'],
    ctaPrimary: 'Contactar',
  },
};

function pickTopReviews(reviews: ReviewData[]): ReviewData[] {
  return reviews
    .filter(r => r.text && r.text.length > 30)
    .sort((a, b) => {
      const starDiff = (b.stars ?? 0) - (a.stars ?? 0);
      if (starDiff !== 0) return starDiff;
      return (b.likesCount ?? 0) - (a.likesCount ?? 0);
    })
    .slice(0, 8);
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
    guidance: 'Úsalas en la sección "Visítanos" o "Cómo llegar". Una puede ir como background del hero (con overlay) si encaja con el tono.',
    priority: 1,
  },
  interior: {
    title: '🏠 Interior del local',
    guidance: 'Sección "El espacio" / "Sobre el lugar". Si el negocio depende del ambiente (restaurante, hotel, salón), usa la mejor en el hero.',
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

function pickHeroCandidates(metadata: PhotoMetadata[]): PhotoMetadata[] {
  const explicit = metadata.filter(m => m.heroCandidate && m.quality === 'buena');
  if (explicit.length > 0) return explicit.slice(0, 3);
  const fallback = metadata
    .filter(m => m.quality === 'buena' && ['exterior', 'interior', 'producto', 'trabajo_terminado'].includes(m.type))
    .slice(0, 3);
  if (fallback.length > 0) return fallback;
  return metadata.filter(m => m.quality !== 'mala').slice(0, 1);
}

export function generatePromptMd(
  business: BusinessData,
  reviews: ReviewData[],
  photoUrls: string[],
  photoMetadata?: PhotoMetadata[],
): string {
  const kind = inferBusinessKind(business);
  const strategy = KIND_STRATEGY[kind];
  const hasMetadata = !!photoMetadata && photoMetadata.length > 0;

  // Fallback al sistema por orden si no hay metadata (extracciones antiguas)
  const heroPhoto = photoUrls[0];
  const featuredPhotos = photoUrls.slice(1, 7);
  const galleryPhotos = photoUrls.slice(7);

  const lines: string[] = [];

  lines.push(`# Prompt para la web de ${business.title ?? 'este negocio'}`);
  lines.push('');
  lines.push('> Pega este prompt completo (sin recortar) en Lovable, Cursor, Bolt, v0, ChatGPT, Claude o cualquier herramienta de vibe coding. Está optimizado para que el resultado sea una web profesional y bien diseñada, no un montón de fotos sueltas en una página vacía.');
  lines.push('');
  lines.push('---');
  lines.push('');

  // ========== ROL ==========
  lines.push('## 1. Tu rol');
  lines.push('');
  lines.push(`Eres un diseñador web senior y un copywriter especializado en negocios locales. Tu trabajo es crear una **landing page de UNA sola página** (single page con secciones que navegan por anchors) para **${business.title ?? 'este negocio'}**${business.categoryName ? ` (${business.categoryName})` : ''}${business.city ? ` en ${business.city}` : ''}.`);
  lines.push('');
  lines.push('La web tiene que verse como hecha por un estudio de diseño, no como un template genérico relleno con fotos. Si tienes que elegir entre meter más contenido o que respire mejor, **siempre prioriza que respire**.');
  lines.push('');

  // ========== ANTES DE EMPEZAR ==========
  lines.push('## 2. Antes de escribir una sola línea de código');
  lines.push('');
  lines.push('Para esta sección, **piensa primero, código después**. Antes de generar nada:');
  lines.push('');
  lines.push('1. **Identifica el tono** del negocio leyendo las reseñas y la categoría. ¿Es cercano? ¿Premium? ¿Técnico? El copy debe sonar a eso.');
  lines.push('2. **Decide la asignación de fotos**: qué foto va de hero, cuáles destacadas, cuáles a galería. Asigna cada foto a una función concreta. **No uses una foto sin saber qué papel cumple.**');
  lines.push('3. **Planifica el sistema de diseño antes de codear**: paleta (3-4 colores máximo), 2 fuentes (display + sans-serif), escala de espaciado (4, 8, 16, 24, 32, 48, 64, 96px), border-radius coherente.');
  lines.push('4. **Decide qué reseñas usar como testimonios** (3-5 máximo, no las 8). Las pones tal cual, sin editar.');
  lines.push('');

  // ========== ESTRATEGIA VISUAL ==========
  lines.push(`## 3. Estrategia visual para este negocio (categoría: ${kind})`);
  lines.push('');
  lines.push(`**Vibe:** ${strategy.vibe}`);
  lines.push('');
  lines.push(`**Paleta sugerida:** ${strategy.palette}`);
  lines.push('');
  lines.push(`**Hero recomendado:** ${strategy.heroLayout}`);
  lines.push('');
  lines.push(`**CTA principal:** "${strategy.ctaPrimary}" repetido al menos 2 veces en la página (uno en hero, uno al final). Si hay teléfono, el botón de llamar debe ser \`tel:\` para que en móvil llame directamente.`);
  lines.push('');
  lines.push('**Estructura de secciones recomendada (en este orden):**');
  for (const [i, s] of strategy.primarySections.entries()) {
    lines.push(`${i + 1}. ${s}`);
  }
  lines.push('');

  // ========== REGLAS DE FOTOS ==========
  lines.push('## 4. Reglas estrictas sobre las fotos (las más importantes)');
  lines.push('');
  lines.push('Este es el error más típico que tienes que evitar:');
  lines.push('');
  lines.push('### ❌ NO hagas esto');
  lines.push('- **NO** metas fotos sueltas en medio de un párrafo de texto.');
  lines.push('- **NO** las uses como "decoración" en cualquier sitio para rellenar.');
  lines.push('- **NO** uses todas las fotos. Si hay 25, no significa que tengan que aparecer 25.');
  lines.push('- **NO** las mezcles con aspect ratios distintos en el mismo grid (rompe la composición).');
  lines.push('- **NO** las pongas a tamaño completo sin recorte: usa `object-fit: cover` y un aspect-ratio fijado por el contenedor.');
  lines.push('- **NO** las metas dentro de cards de servicios si las fotos no representan ese servicio concreto.');
  lines.push('');
  lines.push('### ✅ SÍ haz esto');
  lines.push('- **Cada foto tiene un rol asignado**: hero, destacada, galería, o background de sección. No "fotos sueltas".');
  lines.push('- **Aspect ratios consistentes por sección**: galería tipo grid → todas 4:3 o 1:1. Hero → 16:9 o 21:9. Cards → 3:2.');
  lines.push('- **Lazy loading** en todas (`loading="lazy"`) salvo el hero.');
  lines.push('- **alt descriptivo** con el nombre del negocio y qué se ve.');
  lines.push('- **Galería con lightbox** si hay más de 6 fotos.');
  lines.push(`- ${strategy.photoStrategy}`);
  lines.push('');

  // ========== ASIGNACIÓN DE FOTOS ==========
  if (photoUrls.length === 0) {
    lines.push('## 5. Fotos');
    lines.push('');
    lines.push('No hay fotos disponibles para este negocio. No inventes ni uses imágenes placeholder genéricas: en su lugar, refuerza el diseño con tipografía, color y composición. Considera usar iconos coherentes (Lucide o similar) en lugar de imágenes. Si el resultado queda pobre, sugiere al dueño aportar 5-8 fotos profesionales.');
    lines.push('');
  } else if (hasMetadata) {
    // VERSIÓN CON METADATA — fotos clasificadas por Claude Vision
    lines.push('## 5. Asignación concreta de fotos (clasificadas por IA)');
    lines.push('');
    lines.push('Las URLs son permanentes (alojadas en nuestro CDN). Cada foto ha sido clasificada por su tipo y calidad. Las fotos de baja calidad ya están descartadas — todo lo que ves aquí es usable.');
    lines.push('');
    lines.push('**Regla de oro:** usa las fotos en la sección que indica cada grupo. NO las muevas a otras secciones. La asignación no es decorativa, es funcional.');
    lines.push('');

    const heroCandidates = pickHeroCandidates(photoMetadata!);
    if (heroCandidates.length > 0) {
      lines.push('### 🌟 Hero (elige UNA de estas — son las más fotogénicas)');
      lines.push('');
      lines.push('Estas fotos están marcadas como aptas para portada. Elige la que mejor encaje con el tono del negocio. **Solo una.**');
      lines.push('');
      for (const p of heroCandidates) {
        lines.push(`- ${p.url}${p.description ? ` — _${p.description}_` : ''}`);
      }
      lines.push('');
    }

    const groups = groupPhotosByType(photoMetadata!);
    for (const group of groups) {
      lines.push(`### ${group.title} (${group.photos.length})`);
      lines.push('');
      lines.push(`> ${group.guidance}`);
      lines.push('');
      for (const p of group.photos) {
        const qualityTag = p.quality === 'regular' ? ' _(calidad media — úsala solo si encaja)_' : '';
        lines.push(`- ${p.url}${p.description ? ` — ${p.description}` : ''}${qualityTag}`);
      }
      lines.push('');
    }

    lines.push('### ⚠️ Recordatorio sobre el uso de fotos');
    lines.push('');
    lines.push('- **No mezcles grupos.** Las fotos de "trabajos terminados" no van en "el espacio". Cada grupo tiene su sección.');
    lines.push('- **Si un grupo tiene 1-2 fotos**, intégralas dentro del contenido de su sección, no hagas un grid medio vacío.');
    lines.push('- **Si un grupo tiene 6+ fotos**, haz grid con lightbox y botón "Ver más".');
    lines.push('- **Logos: nunca como decoración** en mitad de la web. Solo header/favicon/footer.');
    lines.push('- **Fotos de menú/carta**: extrae el texto y maquétalo. La carta fotografiada queda fea.');
    lines.push('');
  } else {
    // FALLBACK — sin metadata (extracciones antiguas)
    lines.push('## 5. Asignación concreta de fotos');
    lines.push('');
    lines.push('Las URLs son permanentes (alojadas en nuestro CDN), úsalas directamente con `<img>` o `next/image`.');
    lines.push('');

    if (heroPhoto) {
      lines.push('### 🌟 Hero (UNA sola foto)');
      lines.push('');
      lines.push('Esta es la foto principal. Va a tamaño grande en la primera sección. Si es muy distinta del estilo del resto, considera elegir otra de las destacadas que encaje mejor.');
      lines.push('');
      lines.push(`- ${heroPhoto}`);
      lines.push('');
    }

    if (featuredPhotos.length > 0) {
      lines.push(`### ⭐ Destacadas (${featuredPhotos.length} fotos para galería principal / secciones)`);
      lines.push('');
      lines.push('Úsalas en la galería principal o repartidas en secciones temáticas según la estrategia de arriba. Estas son las que **siempre** aparecen.');
      lines.push('');
      for (const url of featuredPhotos) {
        lines.push(`- ${url}`);
      }
      lines.push('');
    }

    if (galleryPhotos.length > 0) {
      lines.push(`### 📷 Galería extendida (${galleryPhotos.length} fotos opcionales)`);
      lines.push('');
      lines.push('Mételas en un lightbox / modal de galería completa que se abre con un botón "Ver todas las fotos". **No** las pongas todas visibles a la vez.');
      lines.push('');
      for (const url of galleryPhotos) {
        lines.push(`- ${url}`);
      }
      lines.push('');
    }
  }

  // ========== SISTEMA DE DISEÑO ==========
  lines.push('## 6. Sistema de diseño concreto');
  lines.push('');
  lines.push('- **Tailwind CSS** (o el equivalente del stack). No CSS suelto.');
  lines.push('- **Tipografía**: una display para títulos + una sans-serif para texto. Carga desde Google Fonts. Sugerencias por categoría:');
  lines.push('  - food / event / lodging → display serif (Playfair, Cormorant, DM Serif Display) + Inter');
  lines.push('  - service / auto / fitness → sans-serif bold (Bricolage Grotesque, Manrope) + Inter');
  lines.push('  - beauty → display serif fina (Cormorant, Italiana) + Inter');
  lines.push('  - health / education / realestate → sans-serif limpia (DM Sans, Inter) sin display');
  lines.push('- **Escala tipográfica**: hero 64-96px desktop / 40-56px móvil, h2 36-48px, h3 24-28px, body 16-18px con line-height 1.6.');
  lines.push('- **Espaciado entre secciones**: 96-128px desktop, 64-80px móvil. Las secciones tienen que respirar.');
  lines.push('- **Containers**: max-w-6xl (~1152px) centrado con padding lateral. El hero puede ir full-bleed.');
  lines.push('- **Border-radius**: elige uno y úsalo siempre. Recomendado: 12px para cards/botones, 24px para imágenes grandes, 0 para hero full-bleed.');
  lines.push('- **Sombras**: muy sutiles (`shadow-sm` máximo). Mejor bordes finos que sombras pesadas.');
  lines.push('- **Animaciones**: scroll-triggered con Framer Motion o CSS `@starting-style`. Fade-up suave (20px de translate, 600ms). Nada exagerado.');
  lines.push('- **Mobile-first** real: diseña para móvil primero y escala. El menú móvil es hamburguesa con overlay.');
  lines.push('- **Accesibilidad**: contraste AA mínimo, todos los botones con label, formularios con labels visibles.');
  lines.push('');

  // ========== COPY ==========
  lines.push('## 7. Reglas para el copy');
  lines.push('');
  lines.push(`- **Idioma**: ${business.countryCode === 'US' || business.countryCode === 'GB' ? 'inglés' : 'español'} (el del negocio).`);
  lines.push('- **Concreto, no genérico**. Mal: "Ofrecemos servicios de calidad". Bien: "Reformas integrales de cocinas y baños en Madrid desde 2015, con garantía de 3 años".');
  lines.push('- **Usa los datos reales**: nombre, ciudad, categoría, años (si se deducen), precios (si están). Si no tienes el dato, no lo inventes — omítelo.');
  lines.push('- **Reseñas como testimonios**: pega 3-5 reseñas tal cual, **sin reescribir**, con el nombre real y las estrellas. La autenticidad importa más que la gramática perfecta.');
  lines.push('- **Microcopy** en botones: "Pedir cita" en vez de "Click aquí". "Llamar ahora" en vez de "Contacto".');
  lines.push('- **SEO**: title `<NombreNegocio> – <CategoríaCorta> en <Ciudad>`. Meta description de 150-160 chars con beneficio + ciudad.');
  lines.push('- **Datos estructurados**: añade un `<script type="application/ld+json">` con schema.org/LocalBusiness usando los datos de abajo.');
  lines.push('');

  // ========== DATOS DEL NEGOCIO ==========
  lines.push('---');
  lines.push('');
  lines.push('## 8. Datos del negocio (úsalos tal cual, no inventes nada)');
  lines.push('');
  if (business.title) lines.push(`- **Nombre:** ${business.title}`);
  if (business.subTitle) lines.push(`- **Subtítulo:** ${business.subTitle}`);
  if (business.categoryName) lines.push(`- **Categoría principal:** ${business.categoryName}`);
  if (business.categories && business.categories.length > 0) {
    lines.push(`- **Categorías:** ${business.categories.join(', ')}`);
  }
  if (business.description) {
    lines.push(`- **Descripción de Google:** ${business.description}`);
  }
  lines.push('');

  lines.push('### Contacto');
  if (business.address) lines.push(`- **Dirección:** ${business.address}`);
  if (business.neighborhood) lines.push(`- **Barrio:** ${business.neighborhood}`);
  if (business.city) lines.push(`- **Ciudad:** ${business.city}`);
  if (business.postalCode) lines.push(`- **CP:** ${business.postalCode}`);
  if (business.state) lines.push(`- **Provincia:** ${business.state}`);
  if (business.countryCode) lines.push(`- **País:** ${business.countryCode}`);
  if (business.phone) lines.push(`- **Teléfono:** ${business.phone} _(usa \`tel:${business.phoneUnformatted ?? business.phone}\` en los botones)_`);
  if (business.website) lines.push(`- **Web actual:** ${business.website}`);
  if (business.url) lines.push(`- **Google Maps:** ${business.url}`);
  if (business.location) {
    lines.push(`- **Coordenadas GPS:** ${business.location.lat}, ${business.location.lng} _(úsalas para incrustar Google Maps)_`);
  }
  if (business.plusCode) lines.push(`- **Plus Code:** ${business.plusCode}`);
  lines.push('');

  if (business.openingHours && business.openingHours.length > 0) {
    lines.push('### Horarios');
    for (const h of business.openingHours) {
      lines.push(`- **${h.day}:** ${h.hours}`);
    }
    lines.push('');
  }

  if (typeof business.totalScore === 'number' && Number.isFinite(business.totalScore)) {
    lines.push('### Reputación en Google');
    lines.push(`- **Puntuación media:** ${business.totalScore.toFixed(1)} / 5${typeof business.reviewsCount === 'number' ? ` (${business.reviewsCount} reseñas)` : ''}`);
    lines.push('- Muestra esta puntuación en el hero o cerca del CTA como prueba social ("4.8 ★ en Google – 234 reseñas").');
    lines.push('');
  }

  if (business.reviewsTags && business.reviewsTags.length > 0) {
    lines.push('### Temas más mencionados en reseñas');
    lines.push('_(úsalos como keywords reales en el copy de servicios/beneficios)_');
    lines.push('');
    for (const t of business.reviewsTags.slice(0, 12)) {
      lines.push(`- ${t.title} (${t.count})`);
    }
    lines.push('');
  }

  if (business.additionalInfo) {
    const infoLines: string[] = [];
    for (const [section, items] of Object.entries(business.additionalInfo)) {
      const flags: string[] = [];
      for (const item of items) {
        for (const [key, value] of Object.entries(item)) {
          if (value === true) flags.push(key);
        }
      }
      if (flags.length > 0) infoLines.push(`- **${section}:** ${flags.join(', ')}`);
    }
    if (infoLines.length > 0) {
      lines.push('### Servicios / características declaradas');
      lines.push(...infoLines);
      lines.push('');
    }
  }

  // ========== RESEÑAS ==========
  const topReviews = pickTopReviews(reviews);
  if (topReviews.length > 0) {
    lines.push('## 9. Reseñas destacadas para usar como testimonios');
    lines.push('');
    lines.push('Elige 3-5 de estas para la sección de testimonios. **Pégalas tal cual, no las reescribas.** En `reviews.md` tienes todas las demás.');
    lines.push('');
    for (const r of topReviews) {
      lines.push(`> "${r.text}"`);
      lines.push(`> — **${r.name}** · ${'★'.repeat(r.stars ?? 0)}${r.publishAt ? ` · ${r.publishAt}` : ''}`);
      lines.push('');
    }
  }

  // ========== CHECKLIST FINAL ==========
  lines.push('---');
  lines.push('');
  lines.push('## 10. Checklist final antes de entregar');
  lines.push('');
  lines.push('Antes de dar la web por hecha, verifica:');
  lines.push('');
  lines.push('- [ ] Ninguna foto está suelta en medio de un párrafo de texto');
  lines.push('- [ ] Todas las fotos del mismo grid tienen el mismo aspect-ratio');
  lines.push('- [ ] El hero usa **una sola** foto (no un collage)');
  lines.push('- [ ] La galería completa está detrás de un botón "Ver todas las fotos" si hay más de 6');
  lines.push('- [ ] Los CTAs llaman/escriben directo: `tel:`, `mailto:`, link de Google Maps');
  lines.push('- [ ] La puntuación de Google aparece visible como prueba social');
  lines.push('- [ ] Mapa de Google incrustado en la sección de contacto con las coordenadas reales');
  lines.push('- [ ] Schema.org/LocalBusiness en JSON-LD con los datos reales');
  lines.push('- [ ] Mobile testeado: el hero se ve bien en 375px, los grids se reordenan, el menú es hamburguesa');
  lines.push('- [ ] Las secciones respiran (96px+ entre ellas en desktop)');
  lines.push('- [ ] No hay lorem ipsum ni nada inventado');
  lines.push('');
  lines.push('## Archivos en este ZIP');
  lines.push('');
  lines.push('- `prompt.md` — este archivo, el prompt completo');
  lines.push('- `data.json` — todos los datos del negocio en formato estructurado');
  lines.push('- `reviews.md` — todas las reseñas (no solo las destacadas)');
  lines.push('- `images/` — todas las fotos descargadas localmente + `urls.txt` con las URLs originales');
  lines.push('');

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
