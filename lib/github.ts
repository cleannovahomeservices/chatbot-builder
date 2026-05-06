const GITHUB_API = 'https://api.github.com';

export function getOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GITHUB_CLIENT_ID!,
    redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback`,
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

export async function injectWidget(
  token: string,
  owner: string,
  repo: string,
  webhookUrl: string,
  chatbotName: string
): Promise<void> {
  const candidates = ['index.html', 'public/index.html', 'src/index.html'];
  for (const path of candidates) {
    const ok = await tryInjectIntoHtmlFile(token, owner, repo, path, webhookUrl, chatbotName);
    if (ok) return;
  }
  await createStandaloneWidgetFile(token, owner, repo, webhookUrl, chatbotName);
}

async function tryInjectIntoHtmlFile(
  token: string,
  owner: string,
  repo: string,
  filePath: string,
  webhookUrl: string,
  chatbotName: string
): Promise<boolean> {
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };

  const res = await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`, { headers });
  if (!res.ok) return false;

  const file = await res.json();
  const content = Buffer.from(file.content, 'base64').toString('utf-8');
  if (!content.includes('</body>')) return false;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const snippet = `\n  <!-- Chatbot Widget by Chatbot Builder -->\n  <script>window.ChatbotConfig={webhookUrl:"${webhookUrl}",name:"${chatbotName}"};</script>\n  <script src="${appUrl}/widget.js" async defer></script>`;
  const updated = content.replace('</body>', `${snippet}\n</body>`);

  await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/${filePath}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `Add ${chatbotName} chatbot widget`,
      content: Buffer.from(updated).toString('base64'),
      sha: file.sha,
    }),
  });
  return true;
}

async function createStandaloneWidgetFile(
  token: string,
  owner: string,
  repo: string,
  webhookUrl: string,
  chatbotName: string
): Promise<void> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const content = `// ${chatbotName} — Chatbot Widget\nwindow.ChatbotConfig={webhookUrl:"${webhookUrl}",name:"${chatbotName}"};\n(function(){var s=document.createElement('script');s.src='${appUrl}/widget.js';s.async=true;document.addEventListener('DOMContentLoaded',function(){document.body.appendChild(s);});})();`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };
  await fetch(`${GITHUB_API}/repos/${owner}/${repo}/contents/chatbot-widget.js`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `Add ${chatbotName} chatbot widget`,
      content: Buffer.from(content).toString('base64'),
    }),
  });
}
