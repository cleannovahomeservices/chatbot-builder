const GITHUB_API = 'https://api.github.com';

export function getOAuthUrl(state: string, origin: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: `${origin}/api/auth/callback`,
    scope: 'read:user user:email repo',
    state,
  });
  return `https://github.com/login/oauth/authorize?${params}`;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });
  const data = await res.json();
  return data.access_token;
}

export async function getGitHubUser(token: string) {
  const [userRes, emailsRes] = await Promise.all([
    fetch(`${GITHUB_API}/user`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    }),
    fetch(`${GITHUB_API}/user/emails`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    }),
  ]);
  const user = await userRes.json();
  const emails = await emailsRes.json();
  const primaryEmail = Array.isArray(emails)
    ? (emails.find((e: { primary: boolean; email: string }) => e.primary)?.email ?? null)
    : null;
  return { ...user, email: primaryEmail };
}

export async function listUserRepos(token: string) {
  const res = await fetch(`${GITHUB_API}/user/repos?sort=updated&per_page=50&type=owner`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  return res.json();
}

export interface InjectResult {
  injected: boolean;
  file?: string;
  reason?: string;
  prUrl?: string;
}

export async function injectWidget(
  token: string,
  owner: string,
  repo: string,
  webhookUrl: string,
  chatbotName: string,
  appUrl: string
): Promise<InjectResult> {
  const headers = makeHeaders(token);

  const treeRes = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
    { headers }
  );

  if (!treeRes.ok) {
    const reason = `tree API ${treeRes.status}`;
    console.error(`[inject] ${owner}/${repo}: ${reason}`);
    return { injected: false, reason };
  }

  const data = await treeRes.json();
  const files: string[] = ((data.tree ?? []) as { type: string; path: string }[])
    .filter((f) => f.type === 'blob')
    .map((f) => f.path)
    .filter((p) => !p.includes('node_modules/') && !p.includes('.next/') && !p.includes('.git/'));

  console.log(`[inject] ${owner}/${repo}: ${files.length} files`);

  const layout = files.find((f) => /^(src\/)?app\/layout\.[jt]sx?$/.test(f));
  if (layout) {
    const result = await tryInjectIntoNextLayout(token, owner, repo, layout, webhookUrl, chatbotName, appUrl);
    if (result.ok) return { injected: !result.prUrl, file: layout, prUrl: result.prUrl };
    return { injected: false, reason: result.error };
  }

  const document = files.find((f) => /^(src\/)?pages\/_document\.[jt]sx?$/.test(f));
  if (document) {
    const result = await tryInjectIntoNextDocument(token, owner, repo, document, webhookUrl, chatbotName, appUrl);
    if (result.ok) return { injected: !result.prUrl, file: document, prUrl: result.prUrl };
    return { injected: false, reason: result.error };
  }

  const htmlFiles = files
    .filter((f) => (f.endsWith('.html') || f.endsWith('.htm')) && !f.includes('/vendor/'))
    .sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length);

  for (const path of htmlFiles) {
    const result = await tryInjectIntoHtmlFile(token, owner, repo, path, webhookUrl, chatbotName, appUrl);
    if (result.ok) return { injected: !result.prUrl, file: path, prUrl: result.prUrl };
  }

  const reason = htmlFiles.length > 0
    ? 'no se pudo modificar ningún archivo (sin permisos o branch protegida)'
    : 'no se encontró layout.tsx, _document ni archivos HTML en el repo';
  return { injected: false, reason };
}

function makeHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
}

interface TryResult {
  ok: boolean;
  error?: string;
  prUrl?: string;
}

// Tries a direct commit; if blocked, falls back to creating a PR on a new branch.
async function putFileDirectOrPR(
  token: string,
  owner: string,
  repo: string,
  filePath: string,
  updatedContent: string,
  fileSha: string,
  message: string,
): Promise<TryResult> {
  const headers = makeHeaders(token);

  const putRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message,
      content: Buffer.from(updatedContent).toString('base64'),
      sha: fileSha,
    }),
  });
  if (putRes.ok) return { ok: true };

  const putError = await putRes.text();
  console.error(`[inject] direct PUT ${putRes.status} on ${filePath}: ${putError.slice(0, 300)}`);

  // Fallback: create a branch + PR
  const prUrl = await tryCreatePR(token, owner, repo, filePath, updatedContent, fileSha, message);
  if (prUrl) return { ok: true, prUrl };

  return { ok: false, error: `PUT ${putRes.status}: ${putError.slice(0, 200)}` };
}

async function tryCreatePR(
  token: string,
  owner: string,
  repo: string,
  filePath: string,
  updatedContent: string,
  fileSha: string,
  message: string,
): Promise<string | null> {
  const headers = makeHeaders(token);

  const repoRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers });
  if (!repoRes.ok) return null;
  const repoData = await repoRes.json();
  const defaultBranch: string = repoData.default_branch ?? 'main';

  const refRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/ref/heads/${defaultBranch}`, { headers });
  if (!refRes.ok) { console.error('[inject] could not get HEAD ref'); return null; }
  const headSha: string = (await refRes.json()).object.sha;

  const branchName = `chatbot-widget-${Date.now()}`;
  const branchRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/refs`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: headSha }),
  });
  if (!branchRes.ok) { console.error('[inject] could not create branch'); return null; }

  const filePutRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message,
      content: Buffer.from(updatedContent).toString('base64'),
      sha: fileSha,
      branch: branchName,
    }),
  });
  if (!filePutRes.ok) {
    console.error(`[inject] PR branch PUT failed: ${await filePutRes.text()}`);
    return null;
  }

  const prRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/pulls`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: message,
      head: branchName,
      base: defaultBranch,
      body: 'Este PR añade el widget del chatbot generado automáticamente. Acepta los cambios para activarlo en tu web.',
    }),
  });
  if (!prRes.ok) { console.error('[inject] PR creation failed'); return null; }
  const prData = await prRes.json();
  return prData.html_url ?? null;
}

async function tryInjectIntoHtmlFile(
  token: string,
  owner: string,
  repo: string,
  filePath: string,
  webhookUrl: string,
  chatbotName: string,
  appUrl: string
): Promise<TryResult> {
  const headers = makeHeaders(token);
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`, { headers });
  if (!res.ok) return { ok: false, error: `GET ${res.status}` };

  const file = await res.json();
  if (!file.content) return { ok: false, error: 'contenido vacío (archivo demasiado grande)' };
  const content = Buffer.from(file.content, 'base64').toString('utf-8');
  if (!content.includes('</body>')) return { ok: false, error: 'sin </body>' };

  const snippet = `\n  <!-- Chatbot: ${chatbotName} -->\n  <script>window.ChatbotConfig={webhookUrl:"${webhookUrl}",name:"${chatbotName}"};</script>\n  <script src="${appUrl}/widget.js" async defer></script>`;
  const updated = content.replace('</body>', `${snippet}\n</body>`);

  return putFileDirectOrPR(token, owner, repo, filePath, updated, file.sha, `Add ${chatbotName} chatbot widget`);
}

async function tryInjectIntoNextLayout(
  token: string,
  owner: string,
  repo: string,
  filePath: string,
  webhookUrl: string,
  chatbotName: string,
  appUrl: string
): Promise<TryResult> {
  const headers = makeHeaders(token);
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`, { headers });
  if (!res.ok) return { ok: false, error: `GET ${res.status}` };

  const file = await res.json();
  if (!file.content) return { ok: false, error: 'contenido vacío (archivo demasiado grande)' };
  const content = Buffer.from(file.content, 'base64').toString('utf-8');

  const marker = content.includes('{children}')
    ? '{children}'
    : content.includes('{ children }')
    ? '{ children }'
    : null;
  if (!marker) return { ok: false, error: 'no se encontró {children} en el layout' };
  const idx = content.indexOf(marker);

  const safeUrl = webhookUrl.replace(/[`"\\]/g, '');
  const safeName = chatbotName.replace(/[`"\\]/g, '');
  const snippet = `\n      {/* Chatbot: ${safeName} */}\n      <script dangerouslySetInnerHTML={{__html:\`window.ChatbotConfig={webhookUrl:"${safeUrl}",name:"${safeName}"};\`}} />\n      <script src="${appUrl}/widget.js" async defer />\n      `;
  const updated = content.slice(0, idx) + snippet + content.slice(idx);

  return putFileDirectOrPR(token, owner, repo, filePath, updated, file.sha, `Add ${safeName} chatbot widget`);
}

async function tryInjectIntoNextDocument(
  token: string,
  owner: string,
  repo: string,
  filePath: string,
  webhookUrl: string,
  chatbotName: string,
  appUrl: string
): Promise<TryResult> {
  const headers = makeHeaders(token);
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`, { headers });
  if (!res.ok) return { ok: false, error: `GET ${res.status}` };

  const file = await res.json();
  if (!file.content) return { ok: false, error: 'contenido vacío (archivo demasiado grande)' };
  const content = Buffer.from(file.content, 'base64').toString('utf-8');

  const safeUrl = webhookUrl.replace(/[`"\\]/g, '');
  const safeName = chatbotName.replace(/[`"\\]/g, '');
  const snippet = `\n        {/* Chatbot: ${safeName} */}\n        <script dangerouslySetInnerHTML={{__html:\`window.ChatbotConfig={webhookUrl:"${safeUrl}",name:"${safeName}"};\`}} />\n        <script src="${appUrl}/widget.js" async defer />\n        `;

  let updated: string;
  if (content.includes('</Head>')) {
    updated = content.replace('</Head>', `${snippet}\n      </Head>`);
  } else if (content.includes('{children}')) {
    const idx = content.indexOf('{children}');
    updated = content.slice(0, idx) + snippet + content.slice(idx);
  } else {
    return { ok: false, error: 'sin </Head> ni {children}' };
  }

  return putFileDirectOrPR(token, owner, repo, filePath, updated, file.sha, `Add ${safeName} chatbot widget`);
}
