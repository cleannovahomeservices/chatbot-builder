const VERCEL_API = 'https://api.vercel.com';
const VERCEL_TOKEN_URL = 'https://api.vercel.com/v2/oauth/access_token';
const INTEGRATION_SLUG = 'botluma';

export function getVercelInstallUrl(state: string): string {
  return `https://vercel.com/integrations/${INTEGRATION_SLUG}/new?state=${encodeURIComponent(state)}`;
}

export async function exchangeVercelCode(
  code: string,
  redirectUri: string,
): Promise<{ access_token: string; team_id?: string; installation_id?: string }> {
  const res = await fetch(VERCEL_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: process.env.VERCEL_CLIENT_ID!,
      client_secret: process.env.VERCEL_CLIENT_SECRET!,
      redirect_uri: redirectUri,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Vercel token exchange failed (${res.status}): ${text}`);
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

export async function listVercelProjects(token: string, teamId?: string | null): Promise<VercelProject[]> {
  const url = teamId
    ? `${VERCEL_API}/v9/projects?limit=50&teamId=${encodeURIComponent(teamId)}`
    : `${VERCEL_API}/v9/projects?limit=50`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token de Vercel inválido o expirado (${res.status}): ${text}`);
  }
  const data = await res.json();
  return data.projects ?? [];
}
