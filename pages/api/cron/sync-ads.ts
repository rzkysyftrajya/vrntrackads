import { createClient } from '@supabase/supabase-js';
import { fetchGoogleAdsMetrics } from '@/lib/googleAds';

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, error: 'Method not allowed. Use GET.' });
  }

  try {
    // 1. Optional security check: verify CRON_SECRET for Vercel Cron
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers?.authorization;
      if (authHeader !== `Bearer ${cronSecret}`) {
        return res.status(401).json({
          success: false,
          error: 'Unauthorized: Invalid or missing bearer token',
        });
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
      return res.status(500).json({
        success: false,
        error: 'Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)',
      });
    }

    // 3. Fetch metrics from Google Ads API
    const metrics = await fetchGoogleAdsMetrics();

    if (!metrics || metrics.length === 0) {
      return res.status(200).json({
        success: true,
        synced_rows: 0,
        data: [],
      });
    }

    // 4. Initialize Supabase Server Client (Service role key bypasses RLS)
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
      return res.status(500).json({
        success: false,
        error: 'Failed to upsert campaign metrics into Supabase: ' + error.message,
      });
    }

    return res.status(200).json({
      success: true,
      synced_rows: recordsToUpsert.length,
      data: data || recordsToUpsert,
    });
  } catch (error: any) {
    console.error('Google Ads Sync Cron Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error while syncing Google Ads metrics',
    });
  }
}

