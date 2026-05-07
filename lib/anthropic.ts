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
    max_tokens: 1024,
    system:
      'Eres un experto en crear system prompts para chatbots de atención al cliente. Creas prompts claros, profesionales y efectivos.',
    messages: [
      {
        role: 'user',
        content: `Basándote en esta información de negocio, crea un system prompt completo para un chatbot de atención al cliente:

${input}

El system prompt debe:
1. Definir el rol y la personalidad del chatbot
2. Especificar los temas en los que puede ayudar
3. Establecer un tono profesional y amigable
4. Incluir instrucciones para derivar preguntas que no pueda responder
5. Estar en el mismo idioma que la información del negocio

Devuelve ÚNICAMENTE el system prompt, sin explicaciones ni formato adicional.`,
      },
    ],
  });

  const block = msg.content[0];
  if (block.type !== 'text') throw new Error('Unexpected response type from Claude');
  return block.text;
}
