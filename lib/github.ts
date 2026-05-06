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

  // Verify token actually has write access before scanning
  const permRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers });
  if (permRes.ok) {
    const repoData = await permRes.json();
    const perms = repoData.permissions ?? {};
    console.log(`[inject] ${owner}/${repo}: permissions push=${perms.push} admin=${perms.admin}`);
    if (!perms.push) {
      return { injected: false, reason: `token sin permiso de escritura en ${owner}/${repo} (push=false). Asegúrate de que el repo es tuyo o tienes acceso de escritura.` };
    }
  }

  const treeRes = await fetch(
    `${GITHUB_API}/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
    { headers }
  );

  if (!treeRes.ok) {
    const reason = `tree API ${treeRes.status} (repo may be empty or token lacks access)`;
    console.error(`[inject] ${owner}/${repo}: ${reason}`);
    await createStandaloneWidgetFile(token, owner, repo, webhookUrl, chatbotName, appUrl);
    return { injected: false, reason };
  }

  const data = await treeRes.json();
  const files: string[] = ((data.tree ?? []) as { type: string; path: string }[])
    .filter((f) => f.type === 'blob')
    .map((f) => f.path)
    .filter((p) => !p.includes('node_modules/') && !p.includes('.next/') && !p.includes('.git/'));

  console.log(`[inject] ${owner}/${repo}: ${files.length} files, truncated=${data.truncated}`);

  const layout = files.find((f) => /^(src\/)?app\/layout\.[jt]sx?$/.test(f));
  if (layout) {
    const result = await tryInjectIntoNextLayout(token, owner, repo, layout, webhookUrl, chatbotName, appUrl);
    if (result.ok) return { injected: true, file: layout };
    console.error(`[inject] layout PUT failed: ${result.error}`);
    return { injected: false, reason: `layout encontrado (${layout}) pero PUT falló: ${result.error}` };
  }

  const document = files.find((f) => /^(src\/)?pages\/_document\.[jt]sx?$/.test(f));
  if (document) {
    const result = await tryInjectIntoNextDocument(token, owner, repo, document, webhookUrl, chatbotName, appUrl);
    if (result.ok) return { injected: true, file: document };
    console.error(`[inject] _document PUT failed: ${result.error}`);
    return { injected: false, reason: `_document encontrado pero PUT falló: ${result.error}` };
  }

  const htmlFiles = files
    .filter((f) => (f.endsWith('.html') || f.endsWith('.htm')) && !f.includes('/vendor/'))
    .sort((a, b) => a.split('/').length - b.split('/').length || a.length - b.length);

  console.log(`[inject] HTML candidates: ${htmlFiles.slice(0, 5).join(', ') || 'none'}`);

  for (const path of htmlFiles) {
    const result = await tryInjectIntoHtmlFile(token, owner, repo, path, webhookUrl, chatbotName, appUrl);
    if (result.ok) return { injected: true, file: path };
    console.error(`[inject] HTML PUT failed for ${path}: ${result.error}`);
  }

  const reason = (layout || document || htmlFiles.length > 0)
    ? 'candidates found but all PUTs failed (check token write permissions)'
    : 'no HTML, layout or _document files found in repo';
  console.error(`[inject] ${owner}/${repo}: ${reason}`);
  await createStandaloneWidgetFile(token, owner, repo, webhookUrl, chatbotName, appUrl);
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
  if (!file.content) return { ok: false, error: 'file content empty (may be too large)' };
  const content = Buffer.from(file.content, 'base64').toString('utf-8');
  if (!content.includes('</body>')) return { ok: false, error: 'no </body> tag found' };

  const snippet = `\n  <!-- Chatbot: ${chatbotName} -->\n  <script>window.ChatbotConfig={webhookUrl:"${webhookUrl}",name:"${chatbotName}"};</script>\n  <script src="${appUrl}/widget.js" async defer></script>`;
  const updated = content.replace('</body>', `${snippet}\n</body>`);

  const putRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `Add ${chatbotName} chatbot widget`,
      content: Buffer.from(updated).toString('base64'),
      sha: file.sha,
    }),
  });
  if (putRes.ok) return { ok: true };
  const body = await putRes.text();
  return { ok: false, error: `PUT ${putRes.status}: ${body.slice(0, 200)}` };
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
  if (!file.content) return { ok: false, error: 'file content empty (may be too large)' };
  const content = Buffer.from(file.content, 'base64').toString('utf-8');

  const marker = content.includes('{children}')
    ? '{children}'
    : content.includes('{ children }')
    ? '{ children }'
    : null;
  if (!marker) return { ok: false, error: 'no {children} marker found in layout' };
  const idx = content.indexOf(marker);

  const safeUrl = webhookUrl.replace(/[`"\\]/g, '');
  const safeName = chatbotName.replace(/[`"\\]/g, '');

  const snippet = `\n      {/* Chatbot: ${safeName} */}\n      <script dangerouslySetInnerHTML={{__html:\`window.ChatbotConfig={webhookUrl:"${safeUrl}",name:"${safeName}"};\`}} />\n      <script src="${appUrl}/widget.js" async defer />\n      `;
  const updated = content.slice(0, idx) + snippet + content.slice(idx);

  const putRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `Add ${safeName} chatbot widget`,
      content: Buffer.from(updated).toString('base64'),
      sha: file.sha,
    }),
  });
  if (putRes.ok) return { ok: true };
  const body = await putRes.text();
  return { ok: false, error: `PUT ${putRes.status}: ${body.slice(0, 200)}` };
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
  if (!file.content) return { ok: false, error: 'file content empty (may be too large)' };
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
    return { ok: false, error: 'no </Head> or {children} found' };
  }

  const putRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `Add ${safeName} chatbot widget`,
      content: Buffer.from(updated).toString('base64'),
      sha: file.sha,
    }),
  });
  if (putRes.ok) return { ok: true };
  const body = await putRes.text();
  return { ok: false, error: `PUT ${putRes.status}: ${body.slice(0, 200)}` };
}

async function createStandaloneWidgetFile(
  token: string,
  owner: string,
  repo: string,
  webhookUrl: string,
  chatbotName: string,
  appUrl: string
): Promise<void> {
  const content = `// ${chatbotName} — Chatbot Widget\nwindow.ChatbotConfig={webhookUrl:"${webhookUrl}",name:"${chatbotName}"};\n(function(){var s=document.createElement('script');s.src='${appUrl}/widget.js';s.async=true;document.addEventListener('DOMContentLoaded',function(){document.body.appendChild(s);});})();`;
  const headers = makeHeaders(token);
  await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/chatbot-widget.js`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `Add ${chatbotName} chatbot widget`,
      content: Buffer.from(content).toString('base64'),
    }),
  });
}
