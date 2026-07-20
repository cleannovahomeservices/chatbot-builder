import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openaiPrompts = new OpenAI({ apiKey: process.env.OPENAI_API_KEY_PROMPTS });

export async function patchCspInFile(content: string, filename: string, proxyDomain: string): Promise<string | null> {
  const msg = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 4096,
    messages: [{
      role: 'user',
      content: `You are analyzing a web project configuration file for Content-Security-Policy (CSP) headers.

File: ${filename}
Content:
\`\`\`
${content}
\`\`\`

Does this file define a Content-Security-Policy header?

If YES: Return the COMPLETE updated file with "${proxyDomain}" added to BOTH script-src and connect-src directives. Only add it if not already present.
If NO: Return exactly: NO_CSP

Return ONLY the file content or NO_CSP. No markdown fences, no explanation. Preserve all existing formatting exactly.`,
    }],
  });

  const result = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '';
  if (!result || result === 'NO_CSP') return null;
  return result;
}

const PROMPT_SYSTEM_ROLE =
  'Eres un experto en crear system prompts para chatbots de atención al cliente. Creas prompts concretos que incluyen la información real del negocio, no frases genéricas.';

const PROMPT_RULES = `REGLAS CRÍTICAS — debes seguirlas sin excepción:

1. INCRUSTA la información real en el prompt. NO escribas frases genéricas como "puedo informarte sobre nuestros precios" — escribe LOS PRECIOS REALES que aparezcan en el contenido.
   MAL: "Ofrecemos varios servicios a precios competitivos."
   BIEN: "Nuestros servicios y precios: Corte de pelo 15 €, Arreglo de barba 10 €, Corte + barba 20 €."

2. Incluye SIEMPRE (si están en el contenido):
   - Nombre exacto del negocio o espacio
   - Nombre del profesional, fundador o responsable del proyecto
   - Dirección y barrio/ciudad
   - Teléfono, WhatsApp o email de contacto
   - Redes sociales con sus URLs completas (Instagram, YouTube, TikTok, Facebook, etc.)
   - Todos los servicios, clases, talleres o retiros con sus precios exactos (usa una lista clara)
   - Horarios de apertura o disponibilidad por día de la semana
   - Promociones o descuentos vigentes

3. Si una información NO aparece en el contenido, NO la inventes. Omítela o indica que el cliente debe consultar directamente.

4. Define la personalidad del chatbot acorde al tipo de negocio.

5. Responde siempre en el idioma en que el visitante te escriba.

6. REGLA DE ORO — NUNCA REDIRIGIR PARA PRECIOS, SERVICIOS U HORARIOS:
   El chatbot DEBE responder directamente cualquier pregunta sobre precios, servicios, horarios o ubicación usando la información de arriba.
   NUNCA uses frases como "contacta directamente", "consulta con el equipo" o "no tengo esa información" para preguntas sobre precios o servicios que SÍ están en el prompt.
   La sección de derivación al equipo humano es SOLO para: reclamaciones, situaciones complejas, solicitudes explícitas de hablar con una persona, o información que genuinamente no está en el prompt.

7. Al final del prompt incluye una instrucción breve para derivar al equipo humano ÚNICAMENTE cuando el cliente muestre frustración, haga una reclamación, o pida explícitamente hablar con una persona.

8. RESPUESTAS CONCISAS Y ESPECÍFICAS — escribe esta instrucción textualmente en el system prompt que generes:
   "Responde SOLO lo que se te pregunta. Si alguien pregunta por un servicio concreto, da solo ese dato. No listes todo. Si preguntan el horario, da solo el horario. Sé directo y natural, como si respondieras por WhatsApp. No añadas información no solicitada."

Devuelve ÚNICAMENTE el system prompt listo para usar, sin explicaciones ni texto adicional.`;

export async function generateSystemPrompt(input: string): Promise<string> {
  const response = await openaiPrompts.chat.completions.create({
    model: 'gpt-5-mini',
    reasoning_effort: 'low',
    messages: [
      { role: 'system', content: PROMPT_SYSTEM_ROLE },
      {
        role: 'user',
        content: `Analiza el siguiente contenido de un negocio y crea un system prompt completo para su chatbot de atención al cliente.

CONTENIDO DEL NEGOCIO:
${input}

${PROMPT_RULES}`,
      },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) throw new Error('Empty response from OpenAI');
  return text;
}

export interface PdfInput {
  filename: string;
  base64: string;
}

export interface PdfPromptResult {
  prompt: string;
  primaryColor: string | null;
  secondaryColor: string | null;
}

/**
 * Genera el system prompt a partir de PDFs usando Claude, que los lee de forma
 * nativa (ve el layout real: tablas de precios, columnas, cartas). Extraer el
 * texto antes con una librería destrozaría la asociación servicio↔precio, que
 * es justo lo que la regla nº1 exige preservar.
 */
export async function generateSystemPromptFromPdfs(pdfs: PdfInput[]): Promise<PdfPromptResult> {
  const documents = pdfs.map((pdf) => ({
    type: 'document' as const,
    source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: pdf.base64 },
    title: pdf.filename,
  }));

  const msg = await client.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 8000,
    system: PROMPT_SYSTEM_ROLE,
    messages: [
      {
        role: 'user',
        content: [
          ...documents,
          {
            type: 'text',
            text: `Analiza ${pdfs.length === 1 ? 'el documento adjunto' : 'los documentos adjuntos'} de un negocio y crea un system prompt completo para su chatbot de atención al cliente.

Presta especial atención a las TABLAS, cartas y listas de precios: conserva la asociación exacta entre cada servicio/producto y su precio tal y como aparece visualmente en el documento.

${PROMPT_RULES}`,
          },
        ],
      },
    ],
    output_config: {
      format: {
        type: 'json_schema',
        schema: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'El system prompt completo listo para usar, sin explicaciones.',
            },
            primaryColor: {
              type: ['string', 'null'],
              description:
                'Color de marca dominante del documento en hex (#rrggbb), o null si el documento no tiene una identidad de color clara.',
            },
            secondaryColor: {
              type: ['string', 'null'],
              description: 'Color secundario o acento en hex (#rrggbb), o null.',
            },
          },
          required: ['prompt', 'primaryColor', 'secondaryColor'],
          additionalProperties: false,
        },
      },
    },
  });

  const text = msg.content.find((b) => b.type === 'text');
  if (!text || text.type !== 'text' || !text.text.trim()) {
    throw new Error('Empty response from Claude');
  }

  const parsed = JSON.parse(text.text) as PdfPromptResult;
  if (!parsed.prompt?.trim()) throw new Error('Claude devolvió un prompt vacío');

  const hex = (c: unknown): string | null =>
    typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c) ? c.toLowerCase() : null;

  return {
    prompt: parsed.prompt.trim(),
    primaryColor: hex(parsed.primaryColor),
    secondaryColor: hex(parsed.secondaryColor),
  };
}
