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
  _webhookPath: string
): Promise<WorkflowResult> {
  const template = buildWorkflow(name, systemPrompt);

  console.log('[n8n] connecting to:', N8N_BASE);
  let res: Response;
  try {
    res = await fetch(`${N8N_BASE}/api/v1/workflows`, {
      method: 'POST',
      headers: n8nHeaders,
      body: JSON.stringify(template),
    });
  } catch (fetchErr) {
    const cause = fetchErr instanceof Error ? (fetchErr as NodeJS.ErrnoException).cause ?? fetchErr.message : String(fetchErr);
    console.error('[n8n] fetch failed — cause:', cause);
    throw new Error(`n8n no accesible (${cause})`);
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`n8n error: ${err}`);
  }

  const workflow = await res.json();

  // n8n auto-assigns webhookId to the chatTrigger node — read it from the response
  const chatTriggerNode = workflow.nodes?.find(
    (n: { type: string; webhookId?: string }) =>
      n.type === '@n8n/n8n-nodes-langchain.chatTrigger'
  );
  const webhookId: string = chatTriggerNode?.webhookId ?? workflow.id;

  await fetch(`${N8N_BASE}/api/v1/workflows/${workflow.id}/activate`, {
    method: 'POST',
    headers: n8nHeaders,
  });

  return {
    workflowId: String(workflow.id),
    webhookUrl: `${N8N_BASE}/webhook/${webhookId}/chat`,
  };
}

export async function deleteWorkflow(workflowId: string): Promise<void> {
  await fetch(`${N8N_BASE}/api/v1/workflows/${workflowId}`, {
    method: 'DELETE',
    headers: n8nHeaders,
  });
}

export async function setWorkflowActive(workflowId: string, active: boolean): Promise<void> {
  const action = active ? 'activate' : 'deactivate';
  await fetch(`${N8N_BASE}/api/v1/workflows/${workflowId}/${action}`, {
    method: 'POST',
    headers: n8nHeaders,
  });
}

function buildWorkflow(name: string, systemPrompt: string) {
  return {
    name,
    nodes: [
      {
        // No id / versionId / webhookId — n8n generates unique values per workflow
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
