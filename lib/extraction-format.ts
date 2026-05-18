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

export function generatePromptMd(
  business: BusinessData,
  reviews: ReviewData[],
  photoUrls: string[],
): string {
  const lines: string[] = [];

  lines.push(`# Prompt para crear la web de ${business.title ?? 'este negocio'}`);
  lines.push('');
  lines.push('Pega este prompt en Lovable, Cursor, Bolt, v0 o cualquier herramienta de vibe coding para generar la mejor web posible para este negocio.');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Instrucciones para la IA');
  lines.push('');
  lines.push(`Crea una landing page moderna, profesional y de alta conversión para **${business.title ?? 'el negocio'}**${business.categoryName ? `, un/a ${business.categoryName.toLowerCase()}` : ''}${business.city ? ` ubicado en ${business.city}` : ''}.`);
  lines.push('');
  lines.push('La web debe:');
  lines.push('- Tener un diseño limpio, mobile-first, con animaciones suaves');
  lines.push('- Incluir secciones: Hero, Servicios, Galería de fotos, Reseñas reales, Información de contacto, Horarios, Mapa');
  lines.push('- Usar la información real del negocio que aparece más abajo (NO inventes nada)');
  lines.push('- Tener CTAs claros para llamar, reservar o encontrar el negocio');
  lines.push('- Ser SEO-friendly con metadatos completos');
  lines.push('- Cargar las fotos directamente desde las URLs proporcionadas');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Información del negocio');
  lines.push('');
  if (business.title) lines.push(`**Nombre:** ${business.title}`);
  if (business.subTitle) lines.push(`**Subtítulo:** ${business.subTitle}`);
  if (business.categoryName) lines.push(`**Categoría principal:** ${business.categoryName}`);
  if (business.categories && business.categories.length > 0) {
    lines.push(`**Categorías:** ${business.categories.join(', ')}`);
  }
  if (business.description) {
    lines.push('');
    lines.push(`**Descripción:** ${business.description}`);
  }
  lines.push('');

  lines.push('## Contacto');
  lines.push('');
  if (business.address) lines.push(`- **Dirección:** ${business.address}`);
  if (business.neighborhood) lines.push(`- **Barrio:** ${business.neighborhood}`);
  if (business.city) lines.push(`- **Ciudad:** ${business.city}`);
  if (business.postalCode) lines.push(`- **Código postal:** ${business.postalCode}`);
  if (business.state) lines.push(`- **Estado/Provincia:** ${business.state}`);
  if (business.countryCode) lines.push(`- **País:** ${business.countryCode}`);
  if (business.phone) lines.push(`- **Teléfono:** ${business.phone}`);
  if (business.website) lines.push(`- **Web actual:** ${business.website}`);
  if (business.url) lines.push(`- **Google Maps:** ${business.url}`);
  if (business.location) {
    lines.push(`- **Coordenadas GPS:** ${business.location.lat}, ${business.location.lng}`);
  }
  if (business.plusCode) lines.push(`- **Plus Code:** ${business.plusCode}`);
  lines.push('');

  if (business.openingHours && business.openingHours.length > 0) {
    lines.push('## Horarios de apertura');
    lines.push('');
    for (const h of business.openingHours) {
      lines.push(`- **${h.day}:** ${h.hours}`);
    }
    lines.push('');
  }

  if (typeof business.totalScore === 'number') {
    lines.push('## Reputación');
    lines.push('');
    lines.push(`- **Puntuación media:** ${business.totalScore.toFixed(1)} / 5`);
    if (business.reviewsCount) lines.push(`- **Total de reseñas en Google:** ${business.reviewsCount}`);
    if (business.reviewsDistribution) {
      const dist = business.reviewsDistribution;
      lines.push(`- **Distribución:** 5★: ${dist.fiveStar ?? 0} · 4★: ${dist.fourStar ?? 0} · 3★: ${dist.threeStar ?? 0} · 2★: ${dist.twoStar ?? 0} · 1★: ${dist.oneStar ?? 0}`);
    }
    lines.push('');
  }

  if (business.reviewsTags && business.reviewsTags.length > 0) {
    lines.push('## Temas más mencionados en las reseñas');
    lines.push('');
    lines.push('(Úsalos como palabras clave en el copy de la web)');
    lines.push('');
    for (const t of business.reviewsTags.slice(0, 15)) {
      lines.push(`- ${t.title} (${t.count} menciones)`);
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
      lines.push('## Servicios y características');
      lines.push('');
      lines.push(...infoLines);
      lines.push('');
    }
  }

  if (photoUrls.length > 0) {
    lines.push('## Fotos (úsalas en la galería y secciones de la web)');
    lines.push('');
    lines.push('Estas URLs son permanentes — puedes usarlas directamente con `<img src="...">` o el componente `<Image>` de Next.js:');
    lines.push('');
    for (const [i, url] of photoUrls.entries()) {
      lines.push(`${i + 1}. ${url}`);
    }
    lines.push('');
  }

  if (reviews.length > 0) {
    const topReviews = reviews
      .filter(r => r.text && r.text.length > 30)
      .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0) || (b.likesCount ?? 0) - (a.likesCount ?? 0))
      .slice(0, 12);

    if (topReviews.length > 0) {
      lines.push('## Reseñas destacadas (úsalas como testimonios reales en la web)');
      lines.push('');
      for (const r of topReviews) {
        lines.push(`> "${r.text}"`);
        lines.push(`> — **${r.name}** · ${'★'.repeat(r.stars ?? 0)} ${r.publishAt ? `· ${r.publishAt}` : ''}`);
        lines.push('');
      }
    }
  }

  lines.push('---');
  lines.push('');
  lines.push('## Notas finales');
  lines.push('');
  lines.push('- Usa colores que encajen con la categoría del negocio (gastronomía → cálidos, salud → azules/verdes, etc.)');
  lines.push('- Las reseñas son reales: úsalas tal cual, no las modifiques');
  lines.push('- Las fotos están alojadas en URLs permanentes, úsalas directamente');
  lines.push('- En `reviews.md` tienes todas las reseñas (no solo las destacadas) por si quieres mostrar más');
  lines.push('- En `data.json` tienes toda la información estructurada por si la necesitas parseada');
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
