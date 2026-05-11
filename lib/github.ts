import { patchCspInFile } from './anthropic';

const GITHUB_API = 'https://api.github.com';

const CSP_CONFIG_FILES = [
  'vercel.json',
  'netlify.toml',
  '_headers',
  'public/_headers',
  'static/_headers',
  'next.config.js',
  'next.config.ts',
  'next.config.mjs',
];

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
  if (!data.access_token) {
    console.error('[github] token exchange failed:', JSON.stringify(data));
    throw new Error(`GitHub token exchange failed: ${data.error_description ?? data.error ?? 'unknown'}`);
  }
  console.log('[github] token exchange OK, scopes:', data.scope);
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
  const res = await fetch(`${GITHUB_API}/user/repos?sort=updated&per_page=100&type=all`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
  });
  return res.json();
}

export interface InjectResult {
  injected: boolean;
  file?: string;
  reason?: string;
  prUrl?: string;
  cspPatched?: string[];
}

export async function injectWidget(
  token: string,
  owner: string,
  repo: string,
  chatbotId: string,
  chatbotName: string,
  appUrl: string,
  primaryColor = '#7c3aed',
  secondaryColor = '#4338ca',
  widgetStyle = 'bubble',
  iconType = 'chat',
): Promise<InjectResult> {
  const headers = makeHeaders(token);

  // Diagnose: who does this token belong to and does it have push access?
  let tokenOwner = 'desconocido';
  let hasPush = false;
  const meRes = await fetch(`${GITHUB_API}/user`, { headers });
  if (meRes.ok) {
    const me = await meRes.json();
    tokenOwner = me.login ?? 'desconocido';
    console.log(`[inject] token belongs to GitHub user: ${tokenOwner}`);
  } else {
    console.error(`[inject] token invalid — GET /user returned ${meRes.status}`);
    return { injected: false, reason: `Token de GitHub inválido (GET /user: ${meRes.status}). Desconecta y vuelve a conectar GitHub.` };
  }

  const permRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}`, { headers });
  if (permRes.ok) {
    const repoData = await permRes.json();
    hasPush = repoData.permissions?.push ?? false;
    console.log(`[inject] ${owner}/${repo}: push=${hasPush}, token owner=${tokenOwner}`);
    if (!hasPush) {
      return { injected: false, reason: `La cuenta GitHub "${tokenOwner}" no tiene permiso de escritura en ${owner}/${repo}. Necesitas conectar la cuenta que es dueña del repo.` };
    }
  }

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

  let injectResult: InjectResult | null = null;

  const layout = files.find((f) => /^(src\/)?app\/layout\.[jt]sx?$/.test(f));
  if (layout) {
    const result = await tryInjectIntoNextLayout(token, owner, repo, layout, chatbotId, chatbotName, appUrl, primaryColor, secondaryColor, widgetStyle, iconType);
    if (result.ok) injectResult = { injected: !result.prUrl, file: layout, prUrl: result.prUrl };
    else return { injected: false, reason: result.error };
  }

  if (!injectResult) {
    const document = files.find((f) => /^(src\/)?pages\/_document\.[jt]sx?$/.test(f));
    if (document) {
      const result = await tryInjectIntoNextDocument(token, owner, repo, document, chatbotId, chatbotName, appUrl, primaryColor, secondaryColor, widgetStyle, iconType);
      if (result.ok) injectResult = { injected: !result.prUrl, file: document, prUrl: result.prUrl };
      else return { injected: false, reason: result.error };
    }
  }

  if (!injectResult) {
    const htmlFiles = files
      .filter((f) => (f.endsWith('.html') || f.endsWith('.htm')) && !f.includes('/vendor/'))
      .sort((a, b) => {
        // Shallowest depth first, then index.html has priority, then alphabetical
        const depthDiff = a.split('/').length - b.split('/').length;
        if (depthDiff !== 0) return depthDiff;
        const aIsIndex = (a === 'index.html' || a.endsWith('/index.html')) ? 0 : 1;
        const bIsIndex = (b === 'index.html' || b.endsWith('/index.html')) ? 0 : 1;
        return aIsIndex - bIsIndex || a.localeCompare(b);
      });

    for (const path of htmlFiles) {
      const result = await tryInjectIntoMarkupFile(token, owner, repo, path, chatbotId, chatbotName, appUrl, primaryColor, secondaryColor, widgetStyle, iconType);
      // Inject into ALL html files; record first success as the primary result
      if (result.ok && !injectResult) injectResult = { injected: !result.prUrl, file: path, prUrl: result.prUrl };
    }
  }

  if (!injectResult) {
    // PHP/Blade templates: try up to 5, prioritising footer/index/home
    const phpFiles = files
      .filter((f) => (f.endsWith('.php') || f.endsWith('.blade.php')) && !f.includes('/vendor/') && !f.includes('/node_modules/'))
      .sort((a, b) => {
        const priority = (p: string) =>
          /\/(footer|index|home|default)\.[^/]*$/.test(p) || /^(footer|index|home|default)\.[^/]*$/.test(p) ? 0 : 1;
        return priority(a) - priority(b) || a.split('/').length - b.split('/').length || a.length - b.length;
      })
      .slice(0, 5);

    for (const path of phpFiles) {
      const result = await tryInjectIntoMarkupFile(token, owner, repo, path, chatbotId, chatbotName, appUrl, primaryColor, secondaryColor, widgetStyle, iconType);
      if (result.ok) { injectResult = { injected: !result.prUrl, file: path, prUrl: result.prUrl }; break; }
    }

    if (!injectResult) {
      const reason = 'no se encontró layout.tsx, _document, archivos HTML ni PHP con </body> en el repo';
      return { injected: false, reason };
    }
  }

  // Auto-patch CSP config files so the widget is allowed to load
  const cspPatched = await patchCspFiles(token, owner, repo, files, appUrl);
  return { ...injectResult, cspPatched };
}

export async function removeWidget(
  token: string,
  owner: string,
  repo: string,
  chatbotName: string
): Promise<{ removed: boolean; file?: string; reason?: string }> {
  const headers = makeHeaders(token);

  const treeRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`, { headers });
  if (!treeRes.ok) return { removed: false, reason: `tree API ${treeRes.status}` };

  const data = await treeRes.json();
  const files: string[] = ((data.tree ?? []) as { type: string; path: string }[])
    .filter((f) => f.type === 'blob')
    .map((f) => f.path)
    .filter((p) => !p.includes('node_modules/') && !p.includes('.next/'));

  const candidates = [
    files.find((f) => /^(src\/)?app\/layout\.[jt]sx?$/.test(f)),
    files.find((f) => /^(src\/)?pages\/_document\.[jt]sx?$/.test(f)),
    ...files.filter((f) => (f.endsWith('.html') || f.endsWith('.htm')) && !f.includes('/vendor/')),
  ].filter(Boolean) as string[];

  const escaped = chatbotName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let firstRemoved: string | undefined;

  for (const filePath of candidates) {
    const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`, { headers });
    if (!res.ok) continue;
    const file = await res.json();
    if (!file.content) continue;
    const content = Buffer.from(file.content, 'base64').toString('utf-8');

    if (!content.includes(`<!-- Chatbot: ${chatbotName} -->`) && !content.includes(`{/* Chatbot: ${chatbotName} */}`)) continue;

    // Remove ALL HTML-style snippets for this chatbot
    let updated = content.replace(
      new RegExp(`\\n?[ \\t]*<!-- Chatbot: ${escaped} -->[\\s\\S]*?widget\\.js" async defer><\\/script>`, 'g'),
      ''
    );
    // Remove ALL JSX-style snippets for this chatbot
    updated = updated.replace(
      new RegExp(`\\n?[ \\t]*\\{/\\* Chatbot: ${escaped} \\*/\\}[\\s\\S]*?widget\\.js" async defer />[ \\t]*`, 'g'),
      ''
    );
    if (updated === content) continue;

    const putRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        message: `Remove ${chatbotName} chatbot widget`,
        content: Buffer.from(updated).toString('base64'),
        sha: file.sha,
      }),
    });
    if (putRes.ok && !firstRemoved) firstRemoved = filePath;
    // Continue to remove from ALL files, not just the first
  }

  if (firstRemoved) return { removed: true, file: firstRemoved };
  return { removed: false, reason: 'widget no encontrado en ningún archivo' };
}

async function patchCspFiles(
  token: string,
  owner: string,
  repo: string,
  files: string[],
  appUrl: string
): Promise<string[]> {
  const headers = makeHeaders(token);
  const patched: string[] = [];

  const targets = CSP_CONFIG_FILES.filter((f) => files.includes(f));
  if (targets.length === 0) return patched;

  await Promise.all(
    targets.map(async (configFile) => {
      try {
        const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${configFile}`, { headers });
        if (!res.ok) return;
        const file = await res.json();
        if (!file.content) return;
        const content = Buffer.from(file.content, 'base64').toString('utf-8');

        const patchedContent = await patchCspInFile(content, configFile, appUrl);
        if (!patchedContent) return;

        const putRes = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${configFile}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({
            message: `fix: allow chatbot widget in CSP`,
            content: Buffer.from(patchedContent).toString('base64'),
            sha: file.sha,
          }),
        });
        if (putRes.ok) {
          patched.push(configFile);
          console.log(`[csp] patched ${configFile}`);
        }
      } catch (e) {
        console.error(`[csp] error patching ${configFile}:`, e);
      }
    })
  );

  return patched;
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

async function tryInjectIntoMarkupFile(
  token: string,
  owner: string,
  repo: string,
  filePath: string,
  chatbotId: string,
  chatbotName: string,
  appUrl: string,
  primaryColor = '#7c3aed',
  secondaryColor = '#4338ca',
  widgetStyle = 'bubble',
  iconType = 'chat',
): Promise<TryResult> {
  const headers = makeHeaders(token);
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`, { headers });
  if (!res.ok) return { ok: false, error: `GET ${res.status}` };

  const file = await res.json();
  if (!file.content) return { ok: false, error: 'contenido vacío (archivo demasiado grande)' };
  const raw = Buffer.from(file.content, 'base64').toString('utf-8');

  // Remove ALL existing chatbot injections (any name) to avoid duplicates
  const content = raw
    .replace(/\n?[ \t]*<!-- Chatbot: [^\n]+ -->\n[ \t]*<script>window\.ChatbotConfig[^\n]+<\/script>\n[ \t]*<script src="[^\n]+\/widget\.js" async defer><\/script>/g, '')
    .replace(/\n?[ \t]*<!-- Chatbot: [^\n]+ -->\n[ \t]*<script>[^\n]+<\/script>\n[ \t]*<script src="[^\n]+\/widget\.js" async defer><\/script>/g, '');

  const configJson = `{chatbotId:"${chatbotId}",name:"${chatbotName}",primaryColor:"${primaryColor}",secondaryColor:"${secondaryColor}",style:"${widgetStyle}",icon:"${iconType}"}`;
  const snippet = `\n  <!-- Chatbot: ${chatbotName} -->\n  <script>window.ChatbotConfig=${configJson};</script>\n  <script src="${appUrl}/widget.js" async defer></script>`;

  if (content.includes('</body>')) {
    return putFileDirectOrPR(token, owner, repo, filePath, content.replace('</body>', `${snippet}\n</body>`), file.sha, `Add ${chatbotName} chatbot widget`);
  }
  if (content.includes('</head>')) {
    return putFileDirectOrPR(token, owner, repo, filePath, content.replace('</head>', `${snippet}\n</head>`), file.sha, `Add ${chatbotName} chatbot widget`);
  }

  return { ok: false, error: 'sin </body> ni </head>' };
}

async function tryInjectIntoNextLayout(
  token: string,
  owner: string,
  repo: string,
  filePath: string,
  chatbotId: string,
  chatbotName: string,
  appUrl: string,
  primaryColor = '#7c3aed',
  secondaryColor = '#4338ca',
  widgetStyle = 'bubble',
  iconType = 'chat',
): Promise<TryResult> {
  const headers = makeHeaders(token);
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`, { headers });
  if (!res.ok) return { ok: false, error: `GET ${res.status}` };

  const file = await res.json();
  if (!file.content) return { ok: false, error: 'contenido vacío (archivo demasiado grande)' };
  const raw = Buffer.from(file.content, 'base64').toString('utf-8');

  const safeName = chatbotName.replace(/[`"\\]/g, '');
  const safePrimary = primaryColor.replace(/[`"\\]/g, '');
  const safeSecondary = secondaryColor.replace(/[`"\\]/g, '');

  // Remove ALL existing injections for this chatbot before re-injecting
  const escapedName = safeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const content = raw.replace(
    new RegExp(`\\n?[ \\t]*\\{/\\* Chatbot: ${escapedName} \\*/\\}[\\s\\S]*?widget\\.js" async defer />[ \\t]*`, 'g'),
    ''
  );

  const marker = content.includes('{children}') ? '{children}' : content.includes('{ children }') ? '{ children }' : null;
  if (!marker) return { ok: false, error: 'no se encontró {children} en el layout' };
  const idx = content.indexOf(marker);

  const safeStyle = widgetStyle.replace(/[`"\\]/g, '');
  const safeIcon = iconType.replace(/[`"\\]/g, '');
  const configJson = `{chatbotId:"${chatbotId}",name:"${safeName}",primaryColor:"${safePrimary}",secondaryColor:"${safeSecondary}",style:"${safeStyle}",icon:"${safeIcon}"}`;
  const snippet = `\n      {/* Chatbot: ${safeName} */}\n      <script dangerouslySetInnerHTML={{__html:\`window.ChatbotConfig=${configJson};\`}} />\n      <script src="${appUrl}/widget.js" async defer />\n      `;
  const updated = content.slice(0, idx) + snippet + content.slice(idx);

  return putFileDirectOrPR(token, owner, repo, filePath, updated, file.sha, `Add ${safeName} chatbot widget`);
}

async function tryInjectIntoNextDocument(
  token: string,
  owner: string,
  repo: string,
  filePath: string,
  chatbotId: string,
  chatbotName: string,
  appUrl: string,
  primaryColor = '#7c3aed',
  secondaryColor = '#4338ca',
  widgetStyle = 'bubble',
  iconType = 'chat',
): Promise<TryResult> {
  const headers = makeHeaders(token);
  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`, { headers });
  if (!res.ok) return { ok: false, error: `GET ${res.status}` };

  const file = await res.json();
  if (!file.content) return { ok: false, error: 'contenido vacío (archivo demasiado grande)' };
  const content = Buffer.from(file.content, 'base64').toString('utf-8');

  const safeName = chatbotName.replace(/[`"\\]/g, '');
  const safePrimary = primaryColor.replace(/[`"\\]/g, '');
  const safeSecondary = secondaryColor.replace(/[`"\\]/g, '');
  const safeStyle = widgetStyle.replace(/[`"\\]/g, '');
  const safeIcon = iconType.replace(/[`"\\]/g, '');
  const configJson = `{chatbotId:"${chatbotId}",name:"${safeName}",primaryColor:"${safePrimary}",secondaryColor:"${safeSecondary}",style:"${safeStyle}",icon:"${safeIcon}"}`;
  const snippet = `\n        {/* Chatbot: ${safeName} */}\n        <script dangerouslySetInnerHTML={{__html:\`window.ChatbotConfig=${configJson};\`}} />\n        <script src="${appUrl}/widget.js" async defer />\n        `;

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
