const VERCEL_API = 'https://api.vercel.com';

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
