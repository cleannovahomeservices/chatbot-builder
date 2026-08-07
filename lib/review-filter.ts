import Anthropic from '@anthropic-ai/sdk';
import { checkTestimonial, isLiteralExcerpt, trimToSentence, MAX_TESTIMONIAL_LENGTH } from './review-hygiene';

// Elegir testimonios por estrellas y longitud no funciona: deja pasar elogios con un
// "pero" en la última frase y reseñas con precios de hace tres años. Un modelo leyendo
// las 30 sí distingue "todo espectacular" de "todo espectacular aunque tardaron".
//
// Medido el 2026-08-03: Haiku cuesta 0,006 $ por extracción y elige lo mismo que Opus
// (0,048 $) en este trabajo. El regex de `review-hygiene` valida su salida después.

export interface FilterableReview {
  name?: string;
  stars?: number;
  text?: string | null;
  /** Texto final elegido por el pase, ya recortado. Ausente si no lo eligió. */
  curatedText?: string;
  /** Por qué se eligió. Solo para depurar, no se publica. */
  curatedReason?: string;
}

const TARGET = 3;

function buildPrompt(reviews: FilterableReview[], businessTitle: string, category: string): string {
  const numbered = reviews
    .map((r, i) => `${i + 1}. [${r.stars ?? '?'}★] ${r.name ?? 'Anónimo'}: ${(r.text ?? '').replace(/\s+/g, ' ')}`)
    .join('\n');

  return `Eres el dueño de **${businessTitle || 'este negocio'}**${category ? ` (${category})` : ''} y estás eligiendo qué reseñas poner de testimonio en tu propia web nueva.

Abajo tienes ${reviews.length} reseñas reales de Google. Elige **exactamente ${TARGET}**.

Una reseña sirve de testimonio solo si cumple TODO esto:
- Es un elogio limpio: **ni una queja, ni un "pero", ni un matiz negativo**, por pequeño que sea. "Todo genial aunque tardaron un poco" NO vale.
- **No habla de lo que cuesta.** Ni cifras en euros, ni "barato", ni "buena relación calidad-precio", ni siquiera para bien. Los precios cambian y publicar uno viejo es un problema.
- Dice algo **concreto** del negocio (un producto, un servicio, cómo trabajan), no solo "muy bueno, recomendable".
- Se entiende sola, sin contexto.
- No habla de las fotos que subió, ni del propio Google, ni de otra sucursal, ni de un empleado que ya podría no estar.

De las que cumplan, elige ${TARGET} que:
- Cuenten **cosas distintas** entre sí (no tres veces lo mismo).
- Tengan **longitud parecida**, para que las tarjetas de la web queden iguales. Ni una de 300 caracteres junto a una de 60.
- Estén **todas en el mismo idioma**, el de la mayoría de las reseñas. Una en otra lengua en medio de la fila descuadra la sección.

Puedes **recortar** una reseña por una frase completa si sobra algo, pero **no reescribas ni corrijas la ortografía**: la autenticidad es lo que las hace creíbles. El texto que devuelvas tiene que ser literalmente un fragmento del original.

Devuelve SOLO este JSON, sin markdown ni texto alrededor:
{"elegidas":[{"i":<número>,"texto":"<el texto final, recortado si hace falta>","porque":"<media frase>"}]}

${numbered}`;
}

/**
 * Marca con `curatedText` las reseñas que sirven de testimonio. Devuelve siempre el
 * array completo: el ZIP sigue llevando todas, solo cambia cuáles se publican.
 */
export async function curateReviews<T extends FilterableReview>(
  reviews: T[],
  businessTitle: string,
  category: string,
): Promise<T[]> {
  const candidates = reviews
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => (r.stars ?? 0) >= 4 && (r.text ?? '').trim().length > 0);

  if (candidates.length < TARGET) return reviews;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[reviews] ANTHROPIC_API_KEY missing, sin pase de curación');
    return reviews;
  }

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2000,
      messages: [{ role: 'user', content: buildPrompt(candidates.map(c => c.r), businessTitle, category) }],
    });

    const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) {
      console.error('[reviews] respuesta sin JSON');
      return reviews;
    }

    const parsed = JSON.parse(match[0]) as { elegidas?: Array<{ i?: number; texto?: string; porque?: string }> };
    const picked = Array.isArray(parsed.elegidas) ? parsed.elegidas : [];

    let accepted = 0;
    for (const pick of picked) {
      const pos = Number(pick.i) - 1;
      if (!Number.isInteger(pos) || pos < 0 || pos >= candidates.length) continue;

      const original = candidates[pos].r;
      const originalText = (original.text ?? '').trim();
      // Si reescribió en vez de recortar, nos quedamos con el texto real de Google.
      const proposed = (pick.texto ?? '').trim();
      const finalText = proposed && isLiteralExcerpt(proposed, originalText)
        ? proposed
        : trimToSentence(originalText, MAX_TESTIMONIAL_LENGTH);

      const verdict = checkTestimonial(finalText);
      if (!verdict.ok) {
        console.log(`[reviews] descartada la #${pos + 1} por "${verdict.reason}" pese a elegirla el modelo`);
        continue;
      }

      original.curatedText = finalText;
      original.curatedReason = typeof pick.porque === 'string' ? pick.porque.slice(0, 160) : undefined;
      accepted++;
    }

    console.log(`[reviews] ${accepted}/${picked.length} testimonios aceptados de ${candidates.length} candidatas`);
    return reviews;
  } catch (e) {
    console.error('[reviews] error en el pase de curación:', e);
    return reviews;
  }
}
