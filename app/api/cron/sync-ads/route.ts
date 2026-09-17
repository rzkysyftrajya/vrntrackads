import { NextRequest, NextResponse } from 'next/server';
import { fetchGoogleAdsMetrics } from '@/lib/googleAds';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  // 1. Validasi Otorisasi (mencegah endpoint di-spam publik)
  const authHeader = req.headers.get('authorization');
  if (
    process.env.NODE_ENV === 'production' &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json(
      { success: false, message: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    // 2. Fetch data dari Google Ads API
    const adsData = await fetchGoogleAdsMetrics();

    if (!adsData || adsData.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'Tidak ada data kampanye ditemukan.',
      });
    }

    // 3. Upsert data ke Supabase
    const { error } = await supabase
      .from('ad_campaign_metrics')
      .upsert(adsData, { onConflict: 'campaign_id, date' });

    if (error) throw error;

    return NextResponse.json({
      success: true,
      synced_rows: adsData.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}