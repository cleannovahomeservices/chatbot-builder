import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient } from '@/lib/supabase/admin';
import https from 'https';
import { URL } from 'url';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// In-memory conversation history per session (TTL: 30 min)
type Message = { role: 'user' | 'assistant'; content: string };
const sessions = new Map<string, { messages: Message[]; lastAt: number }>();
const SESSION_TTL = 30 * 60 * 1000;

function getHistory(sessionId: string): Message[] {
  const s = sessions.get(sessionId);
  if (!s || Date.now() - s.lastAt > SESSION_TTL) return [];
  return s.messages;
}

function pushHistory(sessionId: string, role: 'user' | 'assistant', content: string) {
  const s = sessions.get(sessionId);
  const messages: Message[] = s ? [...s.messages, { role, content }] : [{ role, content }];
  sessions.set(sessionId, { messages: messages.slice(-20), lastAt: Date.now() });
}

// Legacy n8n proxy (fallback for chatbots without stored system_prompt)
async function callN8n(webhookUrl: string, body: unknown): Promise<unknown> {
  const parsed = new URL(webhookUrl);
  const fallbackIp = process.env.N8N_FALLBACK_IP;
  const useIp = fallbackIp && parsed.hostname === 'n8n-n8n.3asuar.easypanel.host';

  const options: https.RequestOptions = {
    hostname: useIp ? fallbackIp! : parsed.hostname,
    port: Number(parsed.port) || 443,
    path: parsed.pathname + parsed.search,
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Host: parsed.hostname,
    },
    servername: parsed.hostname,
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve(data ? JSON.parse(data) : {}); }
        catch { resolve({ output: data }); }
      });
    });
    req.on('error', reject);
    req.write(JSON.stringify(body));
    req.end();
  });
}

const CORS = { 'Access-Control-Allow-Origin': '*' };

export async function POST(request: NextRequest) {
  const { webhookUrl, message, sessionId } = await request.json();
  if (!webhookUrl || !message) {
    return NextResponse.json({ error: 'Faltan webhookUrl o message' }, { status: 400 });
  }

  // Look up chatbot by webhook URL to get stored system prompt
  const db = createAdminClient();
  const { data: chatbot } = await db
    .from('chatbots')
    .select('system_prompt')
    .eq('n8n_webhook_url', webhookUrl)
    .maybeSingle();

  if (chatbot?.system_prompt) {
    // Use Claude directly — system prompt always up to date from Supabase
    const history = getHistory(sessionId);
    pushHistory(sessionId, 'user', message);

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: chatbot.system_prompt,
      messages: [...history, { role: 'user', content: message }],
    });

    const output = response.content[0].type === 'text' ? response.content[0].text : 'Sin respuesta';
    pushHistory(sessionId, 'assistant', output);

    return NextResponse.json({ output }, { headers: CORS });
  }

  // Fallback: proxy to n8n for chatbots without a stored system prompt
  const result = await callN8n(webhookUrl, { chatInput: message, sessionId });
  return NextResponse.json(result, { headers: CORS });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      ...CORS,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
