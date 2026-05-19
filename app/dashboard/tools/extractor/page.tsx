import { getSession } from '@/lib/session';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserPlanData } from '@/lib/plans';
import { redirect } from 'next/navigation';
import { ExtractorClient } from './client';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface PastExtraction {
  id: string;
  google_url: string;
  status: string;
  business_data: { title?: string; address?: string; totalScore?: number } | null;
  photo_urls: string[] | null;
  reviews: unknown[] | null;
  created_at: string;
}

export default async function ExtractorPage() {
  const user = await getSession();
  if (!user) redirect('/login');

  const db = createAdminClient();
  const [historyRes, planData] = await Promise.all([
    db
      .from('business_extractions')
      .select('id, google_url, status, business_data, photo_urls, reviews, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
    getUserPlanData(user.id),
  ]);

  const past = (historyRes.data as PastExtraction[] | null) ?? [];

  return <ExtractorClient initialHistory={past} planData={planData} />;
}
