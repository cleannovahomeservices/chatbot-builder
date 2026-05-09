const VERCEL_API = 'https://api.vercel.com';

interface VFile {
  name: string;
  type: 'file' | 'directory' | 'lambda' | 'middleware';
  uid: string;
  size?: number;
  children?: VFile[];
}

interface FlatFile {
  path: string;
  uid: string;
  size: number;
  type: 'file' | 'lambda' | 'middleware';
}

function flattenTree(files: VFile[], prefix = ''): FlatFile[] {
  const out: FlatFile[] = [];
  for (const f of files) {
    const full = prefix ? `${prefix}/${f.name}` : f.name;
    if (f.type === 'directory' && f.children?.length) {
      out.push(...flattenTree(f.children, full));
    } else if (f.type === 'file') {
      out.push({ path: full, uid: f.uid, size: f.size ?? 0, type: 'file' });
    } else if (f.type === 'lambda' || f.type === 'middleware') {
      out.push({ path: full, uid: f.uid, size: f.size ?? 0, type: f.type });
    }
  }
  return out;
}

function tq(teamId?: string | null) {
  return teamId ? `&teamId=${encodeURIComponent(teamId)}` : '';
}

export async function injectWidgetViaVercel(
  token: string,
  projectId: string,
  webhookUrl: string,
  appUrl: string,
  teamId?: string | null,
): Promise<{ ok: boolean; isSSR?: boolean; error?: string }> {
  const auth = { Authorization: `Bearer ${token}` };

  // 1. Latest READY production deployment
  const dRes = await fetch(
    `${VERCEL_API}/v6/deployments?projectId=${encodeURIComponent(projectId)}&target=production&state=READY&limit=1${tq(teamId)}`,
    { headers: auth }
  );
  if (!dRes.ok) return { ok: false, error: `Deployments (${dRes.status}): ${await dRes.text()}` };
  const dep = (await dRes.json()).deployments?.[0];
  if (!dep) return { ok: false, error: 'No production deployment found for this project' };

  // 2. List all files
  const fRes = await fetch(
    `${VERCEL_API}/v6/deployments/${dep.uid}/files${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''}`,
    { headers: auth }
  );
  if (!fRes.ok) return { ok: false, error: `List files (${fRes.status}): ${await fRes.text()}` };
  const allFiles = flattenTree(await fRes.json() as VFile[]);

  // SSR projects have serverless functions — cannot inject by copying files
  // (lambda SHAs are not valid file references for new deployments)
  const hasServerless = allFiles.some(f => f.type === 'lambda' || f.type === 'middleware');
  if (hasServerless) {
    return { ok: false, isSSR: true };
  }

  // 3. Find HTML files (static sites only)
  const htmlFiles = allFiles.filter(f => f.path.endsWith('.html'));
  if (!htmlFiles.length) return { ok: false, error: 'No HTML files found — project may be empty or SSR' };

  // 4. Download + inject snippet
  const snippet = `<script>window.ChatbotConfig={webhookUrl:"${webhookUrl}",appUrl:"${appUrl}"};</script>\n<script src="${appUrl}/widget.js" async defer></script>`;
  const modified: { file: string; data: string; encoding: 'base64' }[] = [];

  for (const hf of htmlFiles) {
    const cRes = await fetch(
      `${VERCEL_API}/v7/deployments/${dep.uid}/files/${hf.uid}${teamId ? `?teamId=${encodeURIComponent(teamId)}` : ''}`,
      { headers: auth }
    );
    if (!cRes.ok) continue;
    const html = await cRes.text();
    if (html.includes('ChatbotConfig')) continue;
    const injected = html.includes('</body>')
      ? html.replace('</body>', `${snippet}\n</body>`)
      : html + '\n' + snippet;
    modified.push({ file: hf.path, data: Buffer.from(injected).toString('base64'), encoding: 'base64' });
  }

  if (!modified.length) return { ok: false, error: 'Widget already present in all HTML files' };

  // 5. New deployment: modified files (inline) + unchanged static files by SHA
  const modPaths = new Set(modified.map(f => f.file));
  const refs = allFiles
    .filter(f => f.type === 'file' && !modPaths.has(f.path))
    .map(f => ({ file: f.path, sha: f.uid, size: f.size }));

  const nRes = await fetch(
    `${VERCEL_API}/v13/deployments?forceNew=1${tq(teamId)}`,
    {
      method: 'POST',
      headers: { ...auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: dep.name,
        project: projectId,
        target: 'production',
        files: [...modified, ...refs],
      }),
    }
  );
  if (!nRes.ok) return { ok: false, error: `Create deployment (${nRes.status}): ${await nRes.text()}` };
  return { ok: true };
}
