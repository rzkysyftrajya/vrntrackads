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

    // Parsing aman baik string JSON maupun Object
    if (typeof req.body === 'string') {
      try {
        body = JSON.parse(req.body);
      } catch (e) {
        body = {};
      }
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
      utm_content,
      utm_term,
      keyword,
      user_agent,
      element_text,
      element_href
    } = body;

    if (!tracking_key) {
      return res.status(400).json({ success: false, error: 'Missing tracking_key' });
    }

    const { data, error } = await supabase
      .from('clicks')
      .insert([
        {
          tracking_key,
          event_type: event || 'page_view',
          page_url: page_url || landing_page || '',
          referrer: referrer || null,
          session_id: session_id || null,
          device: 'Desktop',
          browser: 'Unknown',
          gclid: gclid || null,
          utm_source: utm_source || null,
          utm_medium: utm_medium || null,
          utm_campaign: utm_campaign || null,
          utm_content: utm_content || null,
          utm_term: utm_term || null,
          keyword: keyword || null,
          user_agent: user_agent || (req.headers['user-agent'] as string) || null,
          element_text: element_text || null,
          element_href: element_href || null,
          created_at: new Date().toISOString()
        }
      ]);

    if (error) {
      console.error('Supabase Error:', error.message);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error('Crash Detail:', err);
    return res.status(500).json({ success: false, error: err.message || 'Server Error' });
  }
}