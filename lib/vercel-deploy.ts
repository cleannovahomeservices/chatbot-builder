const VERCEL_API = 'https://api.vercel.com';

interface VFile {
  name: string;
  type: 'file' | 'directory' | 'lambda' | 'middleware';
  uid: string;
  size?: number;
  children?: VFile[];
}

function flattenTree(files: VFile[], prefix = ''): { path: string; uid: string; size: number }[] {
  const out: { path: string; uid: string; size: number }[] = [];
  for (const f of files) {
    const full = prefix ? `${prefix}/${f.name}` : f.name;
    if (f.type === 'directory' && f.children?.length) {
      out.push(...flattenTree(f.children, full));
    } else if (f.type === 'file' || f.type === 'lambda') {
      out.push({ path: full, uid: f.uid, size: f.size ?? 0 });
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
): Promise<{ ok: boolean; error?: string }> {
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

  // 3. Find HTML files
  const htmlFiles = allFiles.filter(f => f.path.endsWith('.html'));
  if (!htmlFiles.length) return { ok: false, error: 'No HTML files found — project may be SSR (Next.js, etc.)' };

  // 4. Download + inject
  const snippet = `<script>window.ChatbotConfig={webhookUrl:"${webhookUrl}"};</script>\n<script src="${appUrl}/widget.js" async defer></script>`;
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

  if (!modified.length) return { ok: false, error: 'Widget already injected in all HTML files' };

  // 5. New deployment: modified files + unchanged referenced by SHA
  const modPaths = new Set(modified.map(f => f.file));
  const refs = allFiles
    .filter(f => !modPaths.has(f.path))
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
