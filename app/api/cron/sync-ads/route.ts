import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
// Sesuaikan kedalaman folder sesuai lokasi file route.ts berada
import { fetchGoogleAdsMetrics, type GoogleAdsCampaignMetric } from 
'../../lib/googleAds.js';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // 1. Optional security check: verify CRON_SECRET for Vercel Cron or external schedulers
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: Invalid or missing bearer token' },
          { status: 401 }
        );
      }
    }

    // 2. Validate Supabase environment variables
    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL;

    const supabaseServiceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)',
        },
        { status: 500 }
      );
    }

    // 3. Fetch metrics from Google Ads
    const metrics: GoogleAdsCampaignMetric[] = await fetchGoogleAdsMetrics();

    if (!metrics || metrics.length === 0) {
      return NextResponse.json({
        success: true,
        synced_rows: 0,
        data: [],
      });
    }

    // 4. Initialize Supabase Admin Server Client (bypasses RLS with service role)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // 5. Prepare payload for upsert
    const recordsToUpsert = metrics.map((item) => ({
      campaign_id: item.campaign_id,
      campaign_name: item.campaign_name,
      impressions: item.impressions,
      clicks: item.clicks,
      cost_micros: item.cost_micros,
      cost: item.cost,
      date: item.date,
      updated_at: new Date().toISOString(),
    }));

    // 6. Upsert data with conflict target 'campaign_id, date'
    const { data, error } = await supabase
      .from('ad_campaign_metrics')
      .upsert(recordsToUpsert, {
        onConflict: 'campaign_id,date',
      })
      .select('campaign_id, campaign_name, date, impressions, clicks, cost');

    if (error) {
      console.error('Supabase Upsert Error:', error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to upsert campaign metrics into Supabase: ' + error.message,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      synced_rows: recordsToUpsert.length,
      data: data || recordsToUpsert,
    });
  } catch (error: any) {
    console.error('Google Ads Sync Cron Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error while syncing Google Ads metrics',
      },
      { status: 500 }
    );
  }
}