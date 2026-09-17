import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://qtgbuacxiuntczeaqlqi.supabase.co';

const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    let body: any = {};
    if (typeof req.body === 'string') {
      try { body = JSON.parse(req.body); } catch (e) {}
    } else if (req.body && typeof req.body === 'object') {
      body = req.body;
    }

    const {
      tracking_key,
      event,
      page_url,
      landing_page,
      referrer,
      session_id,
      gclid,
      utm_source,
      utm_medium,
      utm_campaign,
      keyword,
      user_agent
    } = body;

    if (!tracking_key) {
      return res.status(400).json({ success: false, error: 'Missing tracking_key' });
    }

    // 1. Ambil data website/profile dari Supabase berdasarkan tracking_key
    const { data: website } = await supabase
      .from('websites')
      .select('id, user_id')
      .eq('tracking_key', tracking_key)
      .maybeSingle();

    const websiteId = website?.id || null;
    const userId = website?.user_id || null;

    // 2. Tembak ke tabel clicks / page_views (Gunakan payload netral)
    const insertPayload = {
      tracking_key: tracking_key,
      website_id: websiteId,
      user_id: userId,
      landing_page: page_url || landing_page || '',
      page_url: page_url || landing_page || '',
      referrer: referrer || null,
      session_id: session_id || null,
      gclid: gclid || null,
      utm_source: utm_source || null,
      utm_medium: utm_medium || null,
      utm_campaign: utm_campaign || null,
      keyword: keyword || null,
      user_agent: user_agent || req.headers['user-agent'] || null,
      status: 'OK',
      created_at: new Date().toISOString()
    };

    // Coba insert ke tabel page_views terlebih dahulu
    let insertResult = await supabase.from('page_views').insert([insertPayload]);

    // Jika tabel page_views tidak ada / error, fallback insert ke tabel clicks
    if (insertResult.error) {
      console.warn('Fallback ke tabel clicks karena page_views error:', insertResult.error.message);
      insertResult = await supabase.from('clicks').insert([{
        tracking_key: tracking_key,
        landing_page: page_url || landing_page || '',
        gclid: gclid || null,
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
        keyword: keyword || null,
        status: 'OK'
      }]);
    }

    if (insertResult.error) {
      console.error('DALAM SUPABASE ERROR:', insertResult.error);
      return res.status(500).json({ success: false, supabase_error: insertResult.error.message });
    }

    console.log('BERHASIL MASUK SUPABASE!');
    return res.status(200).json({ success: true, message: 'Data logged successfully' });

  } catch (err: any) {
    console.error('CRASH API:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}