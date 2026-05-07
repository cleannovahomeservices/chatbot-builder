import { NextRequest, NextResponse } from 'next/server';
import https from 'https';
import { URL } from 'url';

// Proxies widget chat messages to n8n server-side, bypassing browser DNS/CSP issues.
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

export async function POST(request: NextRequest) {
  const { webhookUrl, message, sessionId } = await request.json();
  if (!webhookUrl || !message) {
    return NextResponse.json({ error: 'Faltan webhookUrl o message' }, { status: 400 });
  }

  const result = await callN8n(webhookUrl, { chatInput: message, sessionId });
  return NextResponse.json(result, {
    headers: { 'Access-Control-Allow-Origin': '*' },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
