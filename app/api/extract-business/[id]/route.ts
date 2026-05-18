import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';

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
    .select('id, user_id, ip_address, google_url, status, business_data, reviews, photo_urls, error_message, created_at, completed_at')
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

  return NextResponse.json({
    id: extraction.id,
    status: extraction.status,
    googleUrl: extraction.google_url,
    business: extraction.business_data,
    reviews: extraction.reviews ?? [],
    photoUrls: extraction.photo_urls ?? [],
    errorMessage: extraction.error_message,
    createdAt: extraction.created_at,
    completedAt: extraction.completed_at,
  });
}
