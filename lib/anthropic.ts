import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

export async function generateSystemPrompt(input: string): Promise<string> {

  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 6000,
    system:
      'Eres un experto en crear system prompts para chatbots de atención al cliente. Creas prompts concretos que incluyen la información real del negocio, no frases genéricas.',
    messages: [
      {
        role: 'user',
        content: `Analiza el siguiente contenido de un negocio y crea un system prompt completo para su chatbot de atención al cliente.

CONTENIDO DEL NEGOCIO:
${input}

REGLAS CRÍTICAS — debes seguirlas sin excepción:

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

Devuelve ÚNICAMENTE el system prompt listo para usar, sin explicaciones ni texto adicional.`,
      },
    ],
  });

  const block = msg.content[0];
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude');
  return block.text;
}
