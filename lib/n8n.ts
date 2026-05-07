import https from 'https';
import { URL } from 'url';

const N8N_BASE = process.env.N8N_BASE_URL!;

const n8nHeaders: Record<string, string> = {
  'X-N8N-API-KEY': process.env.N8N_API_KEY!,
  'Content-Type': 'application/json',
};

export interface WorkflowResult {
  workflowId: string;
  webhookUrl: string;
}

// Connects via IP (bypasses broken DNS) but validates SSL against the real hostname.
// N8N_FALLBACK_IP is set in Vercel env vars when the easypanel DNS is unreachable.
async function n8nRequest<T = unknown>(path: string, method: string, body?: unknown): Promise<T | null> {
  const baseUrl = new URL(N8N_BASE);
  const fallbackIp = process.env.N8N_FALLBACK_IP;

  const options: https.RequestOptions = {
    hostname: fallbackIp ?? baseUrl.hostname,
    port: Number(baseUrl.port) || 443,
    path,
    method,
    headers: {
      ...n8nHeaders,
      Host: baseUrl.hostname,
    },
    servername: baseUrl.hostname, // SNI — SSL cert validated against real hostname
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`n8n HTTP ${res.statusCode}: ${data}`));
        } else {
          resolve(data ? (JSON.parse(data) as T) : null);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

export async function createChatbotWorkflow(
  name: string,
  systemPrompt: string,
  _webhookPath: string
): Promise<WorkflowResult> {
  const template = buildWorkflow(name, systemPrompt);

  const workflow = await n8nRequest<{
    id: string | number;
    nodes: { type: string; webhookId?: string }[];
  }>('/api/v1/workflows', 'POST', template);

  if (!workflow) throw new Error('n8n no devolvió respuesta al crear el workflow');

  const chatTriggerNode = workflow.nodes?.find(
    (n) => n.type === '@n8n/n8n-nodes-langchain.chatTrigger'
  );
  const webhookId = chatTriggerNode?.webhookId ?? String(workflow.id);

  await n8nRequest(`/api/v1/workflows/${workflow.id}/activate`, 'POST');

  return {
    workflowId: String(workflow.id),
    webhookUrl: `${N8N_BASE}/webhook/${webhookId}/chat`,
  };
}

export async function deleteWorkflow(workflowId: string): Promise<void> {
  await n8nRequest(`/api/v1/workflows/${workflowId}`, 'DELETE');
}

export async function setWorkflowActive(workflowId: string, active: boolean): Promise<void> {
  const action = active ? 'activate' : 'deactivate';
  await n8nRequest(`/api/v1/workflows/${workflowId}/${action}`, 'POST');
}

function buildWorkflow(name: string, systemPrompt: string) {
  return {
    name,
    nodes: [
      {
        parameters: {
          public: true,
          mode: 'webhook',
          options: { allowedOrigins: '*' },
        },
        type: '@n8n/n8n-nodes-langchain.chatTrigger',
        typeVersion: 1.3,
        position: [-288, -128],
        name: 'When chat message received',
      },
      {
        parameters: {
          promptType: 'define',
          text: '={{$json.chatInput}}',
          options: {
            systemMessage: systemPrompt,
          },
        },
        type: '@n8n/n8n-nodes-langchain.agent',
        typeVersion: 3,
        position: [-32, -112],
        name: 'AI Agent',
      },
      {
        parameters: {
          model: {
            __rl: true,
            value: 'gpt-4o-mini',
            mode: 'list',
            cachedResultName: 'gpt-4o-mini',
          },
          options: {},
        },
        type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
        typeVersion: 1.2,
        position: [-176, 160],
        name: 'OpenAI Chat Model',
        credentials: {
          openAiApi: {
            id: 'mZzvcE5FSqez5DHF',
            name: 'OpenAi account',
          },
        },
      },
      {
        parameters: {
          sessionIdType: 'customKey',
          sessionKey: '={{ $json.sessionId }}',
        },
        type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
        typeVersion: 1.3,
        position: [144, 176],
        name: 'Simple Memory',
      },
    ],
    connections: {
      'When chat message received': {
        main: [[{ node: 'AI Agent', type: 'main', index: 0 }]],
      },
      'OpenAI Chat Model': {
        ai_languageModel: [[{ node: 'AI Agent', type: 'ai_languageModel', index: 0 }]],
      },
      'Simple Memory': {
        ai_memory: [[{ node: 'AI Agent', type: 'ai_memory', index: 0 }]],
      },
    },
    settings: { executionOrder: 'v1' },
  };
}
