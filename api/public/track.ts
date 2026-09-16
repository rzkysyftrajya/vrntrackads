import { createClient } from '@supabase/supabase-js';

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Info, Apikey');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { event, tracking_key, ...params } = body || {};

    if (!tracking_key || !event) {
      return res.status(400).json({ error: 'Missing tracking_key or event' });
    }

    if (event !== 'impression' && event !== 'click') {
      return res.status(400).json({ error: 'Invalid event type' });
    }

    const supabaseUrl =
      process.env.VITE_SUPABASE_URL ||
      process.env.SUPABASE_URL ||
      'https://qtgbuacxiuntczeaqlqi.supabase.co';

    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      '';

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, user_id, apps_script_url, forwarding_active')
      .eq('tracking_key', tracking_key)
      .maybeSingle();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Invalid tracking key' });
    }

    const userAgent = (req.headers['user-agent'] as string) || '';
    const isMobile = /Mobile|Android|iPhone|iPod/i.test(userAgent);
    const isTablet = /iPad|Tablet/i.test(userAgent);
    const uaDevice = isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'Desktop';
    let uaBrowser = 'Unknown';
    if (/Edg\//i.test(userAgent)) uaBrowser = 'Edge';
    else if (/OPR\//i.test(userAgent)) uaBrowser = 'Opera';
    else if (/Chrome\//i.test(userAgent)) uaBrowser = 'Chrome';
    else if (/Firefox\//i.test(userAgent)) uaBrowser = 'Firefox';
    else if (/Safari\//i.test(userAgent)) uaBrowser = 'Safari';

    const country =
      (req.headers['cf-ipcountry'] as string) ||
      (req.headers['x-country-code'] as string) ||
      (req.headers['x-vercel-ip-country'] as string) ||
      params.country ||
      'Unknown';
    const city =
      (req.headers['cf-ipcity'] as string) ||
      (req.headers['x-vercel-ip-city'] as string) ||
      params.city ||
      'Unknown';
    const ip =
      ((req.headers['x-forwarded-for'] as string) || '').split(',')[0]?.trim() ||
      (req.socket?.remoteAddress || '127.0.0.1');
    const landingPage =
      params.landing_page ||
      params.landingPage ||
      (req.headers.referer ?? '');
    const referrer = params.referrer || '';

    const commonFields = {
      user_id: profile.user_id,
      tracking_key,
      device: params.device || uaDevice,
      ip_address: ip,
      country,
      city,
      landing_page: landingPage,
    };

    if (event === 'impression') {
      const { error } = await supabase.from('impressions').insert({
        ...commonFields,
        browser: uaBrowser,
        referrer,
      });
      if (error) {
        return res.status(500).json({ error: 'Failed to save impression', details: error.message });
      }
    } else {
      const { error } = await supabase.from('clicks').insert({
        ...commonFields,
        gclid: params.gclid || null,
        utm_source: params.utm_source || null,
        utm_medium: params.utm_medium || null,
        utm_campaign: params.utm_campaign || null,
        keyword: params.keyword || null,
      });
      if (error) {
        return res.status(500).json({ error: 'Failed to save click', details: error.message });
      }
    }

    if (profile.forwarding_active && profile.apps_script_url) {
      const forwardPayload = { event, tracking_key, ...params };
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      fetch(profile.apps_script_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(forwardPayload),
        signal: controller.signal,
      })
        .then(() => clearTimeout(timeout))
        .catch(() => {});
    }

    return res.status(200).json({ success: true, event });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
