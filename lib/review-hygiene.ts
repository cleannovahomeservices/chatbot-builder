// Red de seguridad para los testimonios que acaban publicados en la web del cliente.
//
// Filtrar por estrellas no basta: en la web que generó Sushiko se publicó una reseña
// de cinco estrellas que decía "el precio lo considero un poco alto". Un testimonio
// con un matiz negativo, o con un importe que caducó hace dos años, hace más daño que
// no poner testimonio. Esto se aplica SIEMPRE, incluso sobre lo que elige el modelo.
//
// Sin dependencias a propósito: lo importa tanto el pase de IA (`review-filter`) como
// el generador del prompt, que es síncrono.

/** Importes en euros: "12€", "12,50 €", "€15", "20 euros". */
export const MONEY_RE = /(\d[\d.,]*\s*(?:€|eur\b|euros?\b))|((?:€|eur\b)\s*\d)/i;

/** Matices y quejas. Preferimos falsos positivos: con 30 reseñas siempre hay recambio. */
export const COMPLAINT_RE = new RegExp(
  [
    '\\bpero\\b', '\\baunque\\b', 'sin embargo', 'eso s[ií]\\b',
    'lo [úu]nico', 'lo malo', 'lo peor', 'la pega', 'a mejorar', 'mejorable',
    'un poco (?:alto|elevado|car|lento|escaso|justo|lejos|peque)',
    '\\bcar[oa]s?\\b', '\\bcarit[oa]\\b', '\\blent[oa]s?\\b', '\\bflojo\\b',
    'tard(?:a|[óo]|aron|an|amos)\\b', 'esperar?\\b', 'esperamos\\b', '\\bcola\\b',
    'ruidos[oa]', 'decepcion', 'no me gust', 'no volver',
    '\\bsucio\\b', '\\bfr[íi]o\\b', '\\bescas[oa]s?\\b',
  ].join('|'),
  'i',
);

/**
 * Hablar de lo que cuesta, aunque sea para bien. "El precio bastante bien comparado
 * con otros" envejece igual que un importe y, publicado en la home, suena a excusa.
 */
export const PRICE_TALK_RE =
  /\bprecios?\b|\bbarat[oa]s?\b|\becon[óo]mic[oa]s?\b|calidad[- ]precio|\bcuesta\b|\bcobra(?:n|ron)\b|\btarifas?\b/i;

/** Debajo de esto un testimonio no dice nada concreto ("Muy bueno, repetiré"). */
const MIN_LENGTH = 60;

/** Por encima de esto no cabe en una card sin romper la fila. */
export const MAX_TESTIMONIAL_LENGTH = 400;

export interface HygieneVerdict {
  ok: boolean;
  /** Motivo del descarte, para poder depurar por qué una reseña no salió. */
  reason?: 'vacía' | 'corta' | 'precio' | 'queja' | 'mayúsculas';
}

export function checkTestimonial(text: string | null | undefined): HygieneVerdict {
  const t = (text ?? '').trim();
  if (!t) return { ok: false, reason: 'vacía' };
  if (t.length < MIN_LENGTH) return { ok: false, reason: 'corta' };
  if (MONEY_RE.test(t) || PRICE_TALK_RE.test(t)) return { ok: false, reason: 'precio' };
  if (COMPLAINT_RE.test(t)) return { ok: false, reason: 'queja' };
  if (t.length > 20 && t === t.toUpperCase()) return { ok: false, reason: 'mayúsculas' };
  return { ok: true };
}

export function isCleanTestimonial(text: string | null | undefined): boolean {
  return checkTestimonial(text).ok;
}

/** Versión indulgente: solo bloquea lo que es un problema real (importes). */
export function isPublishable(text: string | null | undefined): boolean {
  const t = (text ?? '').trim();
  return t.length > 0 && !MONEY_RE.test(t);
}

/**
 * Recorta por frase completa. Cortar a medias una reseña deja un testimonio que
 * parece manipulado, que es justo lo contrario de lo que aporta una reseña real.
 */
export function trimToSentence(text: string, max = MAX_TESTIMONIAL_LENGTH): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const lastStop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
  if (lastStop > max * 0.5) return cut.slice(0, lastStop + 1).trim();
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 0 ? lastSpace : max).trim()}…`;
}

/**
 * Comprueba que el modelo recortó en vez de reescribir. Una reseña reescrita suena
 * a marketing y deja de valer como prueba social, así que si no es un fragmento
 * literal del original la descartamos y usamos el texto de Google tal cual.
 */
export function isLiteralExcerpt(candidate: string, original: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[…"'“”«»]/g, '').replace(/\s+/g, ' ').trim();
  return norm(original).includes(norm(candidate).replace(/[.!?]+$/, ''));
}
