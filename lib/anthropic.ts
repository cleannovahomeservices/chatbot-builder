import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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
