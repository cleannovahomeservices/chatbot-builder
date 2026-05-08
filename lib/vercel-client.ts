const VERCEL_API = 'https://api.vercel.com';

export function getVercelOAuthUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    client_id: process.env.VERCEL_CLIENT_ID!,
    redirect_uri: redirectUri,
    state,
    response_type: 'code',
    scope: 'email profile offline_access',
  });
  return `https://vercel.com/oauth/authorize?${params}`;
}

export async function exchangeVercelCode(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; refresh_token?: string }> {
  const res = await fetch(`${VERCEL_API}/v2/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.VERCEL_CLIENT_ID!,
      client_secret: process.env.VERCEL_CLIENT_SECRET!,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vercel token exchange failed: ${text}`);
  }
  return res.json();
}

export interface VercelProject {
  id: string;
  name: string;
  framework: string | null;
  link?: {
    type: string;
    repo: string;
    org: string;
  };
}

export async function listVercelProjects(token: string): Promise<VercelProject[]> {
  const res = await fetch(`${VERCEL_API}/v9/projects?limit=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Token de Vercel inválido o expirado');
  const data = await res.json();
  return data.projects ?? [];
}

export async function validateVercelToken(token: string): Promise<{ username: string }> {
  const res = await fetch(`${VERCEL_API}/v2/user`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Token inválido');
  const data = await res.json();
  return { username: data.user?.username ?? data.user?.email };
}
