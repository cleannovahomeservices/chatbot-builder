const N8N_BASE = process.env.N8N_BASE_URL!;

const n8nHeaders = {
  'X-N8N-API-KEY': process.env.N8N_API_KEY!,
  'Content-Type': 'application/json',
};

export interface WorkflowResult {
  workflowId: string;
  webhookUrl: string;
}

export async function createChatbotWorkflow(
  name: string,
  systemPrompt: string,
  webhookPath: string
): Promise<WorkflowResult> {
  const template = buildWorkflow(name, systemPrompt, webhookPath);

  const res = await fetch(`${N8N_BASE}/api/v1/workflows`, {
    method: 'POST',
    headers: n8nHeaders,
    body: JSON.stringify(template),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`n8n error: ${err}`);
  }

  const workflow = await res.json();

  await fetch(`${N8N_BASE}/api/v1/workflows/${workflow.id}/activate`, {
    method: 'POST',
    headers: n8nHeaders,
  });

  return {
    workflowId: String(workflow.id),
    webhookUrl: `${N8N_BASE}/webhook/${webhookPath}`,
  };
}

export async function deleteWorkflow(workflowId: string): Promise<void> {
  await fetch(`${N8N_BASE}/api/v1/workflows/${workflowId}`, {
    method: 'DELETE',
    headers: n8nHeaders,
  });
}

// ── TODO: replace buildWorkflow with your actual n8n template ─────────────
// When you paste the JSON template, replace the `nodes`, `connections`,
// and `settings` fields below. Use {{WEBHOOK_PATH}} and {{SYSTEM_PROMPT}}
// as placeholders — they will be replaced at runtime.
function buildWorkflow(name: string, systemPrompt: string, webhookPath: string) {
  return {
    name,
    nodes: [
      {
        parameters: {
          httpMethod: 'POST',
          path: webhookPath,
          responseMode: 'responseNode',
          options: {},
        },
        id: 'node-webhook',
        name: 'Webhook',
        type: 'n8n-nodes-base.webhook',
        typeVersion: 2,
        position: [250, 300],
        webhookId: webhookPath,
      },
      {
        parameters: {
          respondWith: 'json',
          responseBody:
            '={{ {"message": "Chatbot activo. Conecta tu template de n8n para activar la IA."} }}',
          options: {},
        },
        id: 'node-respond',
        name: 'Respond to Webhook',
        type: 'n8n-nodes-base.respondToWebhook',
        typeVersion: 1,
        position: [500, 300],
      },
    ],
    connections: {
      Webhook: {
        main: [[{ node: 'Respond to Webhook', type: 'main', index: 0 }]],
      },
    },
    settings: { executionOrder: 'v1' },
    active: false,
    meta: { systemPrompt },
  };
}
