import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { generatePromptMd, generateReviewsMd } from '@/lib/extraction-format';

export const maxDuration = 60;

function safeFilename(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9-_]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 60) || 'extraccion';
}

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip')?.trim() ?? 'unknown';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSession();
  const ip = getClientIp(request);

  const db = createAdminClient();
  const { data: extraction, error } = await db
    .from('business_extractions')
    .select('*')
    .eq('id', id)
    .single();

  if (error || !extraction) {
    return NextResponse.json({ error: 'Extracción no encontrada' }, { status: 404 });
  }

  const isOwner =
    (user && extraction.user_id === user.id) ||
    (!extraction.user_id && extraction.ip_address === ip);

  if (!isOwner) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 });
  }

  if (extraction.status !== 'completed') {
    return NextResponse.json({ error: 'La extracción no está completada' }, { status: 400 });
  }

  const business = extraction.business_data ?? {};
  const reviews = extraction.reviews ?? [];
  const photoUrls: string[] = extraction.photo_urls ?? [];

  const zip = new JSZip();

  const promptMd = generatePromptMd(business, reviews, photoUrls);
  zip.file('prompt.md', promptMd);

  zip.file('data.json', JSON.stringify({ business, reviews, photoUrls }, null, 2));

  if (reviews.length > 0) {
    zip.file('reviews.md', generateReviewsMd(reviews, business.title));
  }

  if (photoUrls.length > 0) {
    const imagesFolder = zip.folder('images');
    if (imagesFolder) {
      const downloadResults = await Promise.allSettled(
        photoUrls.map(async (url, idx) => {
          const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
          if (!res.ok) return null;
          const buf = await res.arrayBuffer();
          const ext = url.split('.').pop()?.split('?')[0] ?? 'jpg';
          const safeExt = /^(jpg|jpeg|png|webp|gif)$/i.test(ext) ? ext : 'jpg';
          return { name: `photo-${String(idx + 1).padStart(2, '0')}.${safeExt}`, buf };
        }),
      );
      for (const r of downloadResults) {
        if (r.status === 'fulfilled' && r.value) {
          imagesFolder.file(r.value.name, r.value.buf);
        }
      }
      imagesFolder.file('urls.txt', photoUrls.map((u, i) => `photo-${String(i + 1).padStart(2, '0')}: ${u}`).join('\n'));
    }
  }

  const zipBuffer = await zip.generateAsync({ type: 'uint8array' });

  const filename = `${safeFilename(business.title ?? 'negocio')}.zip`;

  return new NextResponse(zipBuffer as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(zipBuffer.byteLength),
    },
  });
}
