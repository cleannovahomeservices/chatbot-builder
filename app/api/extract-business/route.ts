import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { checkExtractionLimit } from '@/lib/plans';
import { classifyPhotos } from '@/lib/photo-classify';

export const maxDuration = 300;

const APIFY_ACTOR = 'compass~crawler-google-places';
const MAX_REVIEWS = 150;
const MAX_IMAGES = 25;

const ANON_MONTHLY_LIMIT = 2;

interface ApifyPlace {
  title?: string;
  subTitle?: string;
  description?: string;
  price?: string;
  categoryName?: string;
  categories?: string[];
  address?: string;
  neighborhood?: string;
  street?: string;
  city?: string;
  postalCode?: string;
  state?: string;
  countryCode?: string;
  website?: string;
  phone?: string;
  phoneUnformatted?: string;
  claimThisBusiness?: boolean;
  location?: { lat: number; lng: number };
  locatedIn?: string;
  plusCode?: string;
  totalScore?: number;
  permanentlyClosed?: boolean;
  temporarilyClosed?: boolean;
  placeId?: string;
  url?: string;
  searchPageUrl?: string;
  searchPageLoadedUrl?: string;
  searchString?: string;
  language?: string;
  rank?: number;
  reviewsCount?: number;
  reviewsDistribution?: Record<string, number>;
  imagesCount?: number;
  openingHours?: Array<{ day: string; hours: string }>;
  peopleAlsoSearch?: Array<{ category: string; title: string; reviewsCount: number; totalScore: number }>;
  additionalInfo?: Record<string, Array<Record<string, boolean>>>;
  reviewsTags?: Array<{ title: string; count: number }>;
  reviews?: ApifyReview[];
  imageUrls?: string[];
  images?: Array<{ imageUrl: string; authorName?: string; uploadedAt?: string }>;
}

interface ApifyReview {
  reviewerId?: string;
  reviewerUrl?: string;
  name?: string;
  reviewerPhotoUrl?: string;
  reviewerNumberOfReviews?: number;
  isLocalGuide?: boolean;
  text?: string;
  textTranslated?: string | null;
  publishAt?: string;
  publishedAtDate?: string;
  likesCount?: number;
  reviewUrl?: string;
  stars?: number;
  rating?: number | null;
  responseFromOwnerDate?: string | null;
  responseFromOwnerText?: string | null;
}

function isGoogleMapsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return (
      host.includes('google.') && u.pathname.toLowerCase().includes('/maps/') ||
      host === 'goo.gl' ||
      host === 'maps.app.goo.gl' ||
      host === 'g.page'
    );
  } catch {
    return false;
  }
}

async function resolveShortLink(url: string): Promise<string> {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host !== 'maps.app.goo.gl' && host !== 'goo.gl' && host !== 'g.page') {
      return url;
    }
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    });
    const finalUrl = res.url;
    if (finalUrl && finalUrl.includes('google.') && finalUrl.includes('/maps/')) {
      console.log(`[resolve] ${url} -> ${finalUrl}`);
      return finalUrl;
    }
    return url;
  } catch (e) {
    console.error('[resolve] error:', e);
    return url;
  }
}

function getClientIp(request: NextRequest): string {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  const real = request.headers.get('x-real-ip');
  if (real) return real.trim();
  return 'unknown';
}

function getPeriodStart(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

async function checkAnonLimit(ip: string): Promise<{ allowed: boolean; reason?: string }> {
  const db = createAdminClient();
  const { count } = await db
    .from('business_extractions')
    .select('id', { count: 'exact', head: true })
    .is('user_id', null)
    .eq('ip_address', ip)
    .gte('created_at', getPeriodStart());
  if ((count ?? 0) >= ANON_MONTHLY_LIMIT) {
    return { allowed: false, reason: 'Has alcanzado el límite de 2 extracciones gratis por mes. Crea una cuenta para más.' };
  }
  return { allowed: true };
}

async function runApifyExtraction(googleUrl: string): Promise<ApifyPlace | null> {
  const token = process.env.APIFY_API_KEY;
  if (!token) {
    console.error('[apify] APIFY_API_KEY missing');
    return null;
  }

  const input = {
    startUrls: [{ url: googleUrl }],
    language: 'es',
    maxReviews: MAX_REVIEWS,
    maxImages: MAX_IMAGES,
    scrapePlaceDetailPage: true,
    scrapeImageAuthors: false,
    reviewsSort: 'newest',
    reviewsOrigin: 'all',
    maxCrawledPlacesPerSearch: 1,
    deeperCityScrape: false,
    onlyDataFromSearchPage: false,
  };

  const url = `https://api.apify.com/v2/acts/${APIFY_ACTOR}/run-sync-get-dataset-items?token=${token}&timeout=240&memory=4096`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(270_000),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[apify] failed:', res.status, err.slice(0, 500));
      return null;
    }

    const items = await res.json() as ApifyPlace[];
    if (!Array.isArray(items) || items.length === 0) {
      console.error('[apify] empty result');
      return null;
    }

    console.log(`[apify] got place "${items[0].title}" with ${items[0].reviews?.length ?? 0} reviews, ${items[0].imageUrls?.length ?? 0} images`);
    return items[0];
  } catch (e) {
    console.error('[apify] error:', e);
    return null;
  }
}

async function uploadImageToStorage(
  imageUrl: string,
  extractionId: string,
  index: number,
): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, {
      signal: AbortSignal.timeout(15_000),
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    if (!res.ok) return null;

    const arrayBuffer = await res.arrayBuffer();
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const path = `${extractionId}/photo-${String(index).padStart(2, '0')}.${ext}`;

    const db = createAdminClient();
    const { error } = await db.storage
      .from('extractions')
      .upload(path, arrayBuffer, { contentType, upsert: true });

    if (error) {
      console.error('[storage] upload error:', error);
      return null;
    }

    const { data: { publicUrl } } = db.storage.from('extractions').getPublicUrl(path);
    return publicUrl;
  } catch (e) {
    console.error('[storage] fetch/upload error:', e);
    return null;
  }
}

async function uploadAllImages(
  imageUrls: string[],
  extractionId: string,
): Promise<string[]> {
  const toUpload = imageUrls.slice(0, MAX_IMAGES);
  const results = await Promise.allSettled(
    toUpload.map((url, i) => uploadImageToStorage(url, extractionId, i)),
  );
  return results
    .map(r => (r.status === 'fulfilled' ? r.value : null))
    .filter((u): u is string => u !== null);
}

export async function POST(request: NextRequest) {
  const user = await getSession();
  const ip = getClientIp(request);

  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Body JSON inválido' }, { status: 400 });
  }

  const googleUrl = body.url?.trim();
  if (!googleUrl) {
    return NextResponse.json({ error: 'Falta la URL del negocio' }, { status: 400 });
  }
  if (!isGoogleMapsUrl(googleUrl)) {
    return NextResponse.json({ error: 'La URL debe ser de Google Maps (google.com/maps/..., maps.app.goo.gl, etc.)' }, { status: 400 });
  }

  if (!user) {
    const anonCheck = await checkAnonLimit(ip);
    if (!anonCheck.allowed) {
      return NextResponse.json({ error: anonCheck.reason, upgradeRequired: true }, { status: 429 });
    }
  } else {
    const planCheck = await checkExtractionLimit(user.id);
    if (!planCheck.allowed) {
      const isFreeTotal = planCheck.plan === 'free';
      const reason = isFreeTotal
        ? `Has usado las ${planCheck.limit} extracciones del plan gratuito. Mejora tu plan para más extracciones.`
        : `Has alcanzado el límite de ${planCheck.limit} extracciones de este mes en tu plan ${planCheck.plan}. Mejora tu plan para más.`;
      return NextResponse.json({ error: reason, upgradeRequired: true, plan: planCheck.plan, count: planCheck.count, limit: planCheck.limit }, { status: 429 });
    }
  }

  const db = createAdminClient();

  const { data: created, error: insertErr } = await db
    .from('business_extractions')
    .insert({
      user_id: user?.id ?? null,
      ip_address: ip,
      google_url: googleUrl,
      status: 'processing',
    })
    .select('id')
    .single();

  if (insertErr || !created) {
    console.error('[extract] insert error:', insertErr);
    return NextResponse.json({ error: 'No se pudo crear la extracción' }, { status: 500 });
  }

  const extractionId = created.id as string;

  try {
    const resolvedUrl = await resolveShortLink(googleUrl);
    const place = await runApifyExtraction(resolvedUrl);

    if (!place) {
      await db.from('business_extractions').update({
        status: 'failed',
        error_message: 'No se pudo extraer el negocio. Verifica que la URL sea válida.',
        completed_at: new Date().toISOString(),
      }).eq('id', extractionId);
      return NextResponse.json({ error: 'No se pudo extraer el negocio. Verifica que la URL sea válida y que el negocio exista en Google Maps.' }, { status: 422 });
    }

    const rawImageUrls = (place.imageUrls && place.imageUrls.length > 0)
      ? place.imageUrls
      : (place.images ?? []).map(i => i.imageUrl).filter(Boolean);

    const uploadedUrls = await uploadAllImages(rawImageUrls, extractionId);

    // Clasifica las fotos con Claude Vision para luego curar el prompt y filtrar las feas
    const category = place.categoryName ?? place.categories?.[0] ?? '';
    const allMetadata = uploadedUrls.length > 0 ? await classifyPhotos(uploadedUrls, category) : [];
    const goodMetadata = allMetadata.filter(m => m.quality !== 'mala');
    const goodUrls = goodMetadata.map(m => m.url);
    console.log(`[classify] ${uploadedUrls.length} fotos analizadas, ${allMetadata.length - goodMetadata.length} descartadas por calidad mala`);

    const businessData = {
      title: place.title,
      subTitle: place.subTitle,
      description: place.description,
      categoryName: place.categoryName,
      categories: place.categories,
      address: place.address,
      neighborhood: place.neighborhood,
      city: place.city,
      postalCode: place.postalCode,
      state: place.state,
      countryCode: place.countryCode,
      website: place.website,
      phone: place.phone,
      phoneUnformatted: place.phoneUnformatted,
      location: place.location,
      plusCode: place.plusCode,
      totalScore: place.totalScore,
      placeId: place.placeId,
      url: place.url,
      reviewsCount: place.reviewsCount,
      reviewsDistribution: place.reviewsDistribution,
      imagesCount: place.imagesCount,
      openingHours: place.openingHours,
      permanentlyClosed: place.permanentlyClosed,
      temporarilyClosed: place.temporarilyClosed,
      additionalInfo: place.additionalInfo,
      reviewsTags: place.reviewsTags,
    };

    const reviewsData = (place.reviews ?? []).map(r => ({
      name: r.name,
      stars: r.stars,
      text: r.text ?? r.textTranslated,
      publishedAtDate: r.publishedAtDate,
      publishAt: r.publishAt,
      likesCount: r.likesCount,
      isLocalGuide: r.isLocalGuide,
      reviewerNumberOfReviews: r.reviewerNumberOfReviews,
      responseFromOwnerText: r.responseFromOwnerText,
      responseFromOwnerDate: r.responseFromOwnerDate,
    }));

    await db.from('business_extractions').update({
      status: 'completed',
      business_data: businessData,
      reviews: reviewsData,
      photo_urls: goodUrls,
      photo_metadata: goodMetadata,
      completed_at: new Date().toISOString(),
    }).eq('id', extractionId);

    return NextResponse.json({
      id: extractionId,
      title: businessData.title,
      address: businessData.address,
      phone: businessData.phone,
      website: businessData.website,
      categoryName: businessData.categoryName,
      reviewsCount: reviewsData.length,
      photosCount: goodUrls.length,
      totalScore: businessData.totalScore,
      hasOpeningHours: (businessData.openingHours?.length ?? 0) > 0,
    });
  } catch (e) {
    console.error('[extract] error:', e);
    await db.from('business_extractions').update({
      status: 'failed',
      error_message: e instanceof Error ? e.message : 'Error desconocido',
      completed_at: new Date().toISOString(),
    }).eq('id', extractionId);
    return NextResponse.json({ error: 'Error procesando el negocio' }, { status: 500 });
  }
}
