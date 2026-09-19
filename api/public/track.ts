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

function parseUserAgent(userAgent: string) {
  const device = /iPad|Tablet/i.test(userAgent)
    ? 'Tablet'
    : /Mobile|Android|iPhone|iPod/i.test(userAgent)
      ? 'Mobile'
      : 'Desktop';

  let browser = 'Unknown';
  if (/Edg\//i.test(userAgent)) browser = 'Edge';
  else if (/OPR\//i.test(userAgent)) browser = 'Opera';
  else if (/Chrome\//i.test(userAgent)) browser = 'Chrome';
  else if (/Firefox\//i.test(userAgent)) browser = 'Firefox';
  else if (/Safari\//i.test(userAgent)) browser = 'Safari';

  return { device, browser };
}

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
      fingerprint,
      screen_resolution,
      cpu_cores,
      device_memory,
      gpu_renderer,
      timezone,
      language,
      is_bot,
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

    // Resolve the key against the current multi-site table first.
    const { data: website } = await supabase
      .from('websites')
      .select('id, user_id, apps_script_url, forwarding_active')
      .eq('tracking_key', tracking_key)
      .maybeSingle();

    let websiteId = website?.id || null;
    let userId = website?.user_id || null;
    let appsScriptUrl = website?.apps_script_url || null;
    let forwardingActive = website?.forwarding_active ?? true;

    if (!websiteId) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, user_id, apps_script_url, forwarding_active')
        .or(`tracking_key.eq.${tracking_key},user_id.eq.${tracking_key},id.eq.${tracking_key}`)
        .maybeSingle();

      userId = profile?.user_id || profile?.id || null;
      if (profile) {
        appsScriptUrl = profile.apps_script_url || null;
        forwardingActive = profile.forwarding_active ?? true;
      }
    }

    if (!userId) {
      return res.status(404).json({ success: false, error: 'Invalid tracking_key' });
    }

    const forwardedFor = req.headers['x-forwarded-for'];
    const ipAddress = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor?.split(',')[0]?.trim()) ||
      req.headers['x-real-ip'] ||
      req.headers['x-vercel-forwarded-for'] ||
      null;
    const country = req.headers['x-vercel-ip-country'] || req.headers['cf-ipcountry'] || null;
    const rawCity = req.headers['x-vercel-ip-city'] || req.headers['cf-ipcity'] || null;
    const city = rawCity ? decodeURIComponent(rawCity) : null;
    const requestUserAgent = user_agent || req.headers['user-agent'] || '';
    const { device, browser } = parseUserAgent(requestUserAgent);

    // Anti-refresh deduplication (within 1 hour)
    let isDuplicate = false;
    if ((!event || event === 'page_view' || event === 'impression') && fingerprint) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: existingView } = await supabase
        .from('page_views')
        .select('id')
        .eq('tracking_key', tracking_key)
        .eq('fingerprint', fingerprint)
        .gte('created_at', oneHourAgo)
        .limit(1)
        .maybeSingle();

      if (existingView) {
        isDuplicate = true;
      }
    }

    const eventStatus = is_bot
      ? 'BOT_FILTERED'
      : isDuplicate
        ? 'DUPLICATE'
        : 'OK';

    const commonPayload = {
      tracking_key: tracking_key,
      website_id: websiteId,
      user_id: userId,
      landing_page: page_url || landing_page || '',
      referrer: referrer || null,
      session_id: session_id || null,
      fingerprint: fingerprint || null,
      screen_resolution: screen_resolution || null,
      cpu_cores: typeof cpu_cores === 'number' ? cpu_cores : (cpu_cores ? parseInt(cpu_cores, 10) : null),
      device_memory: typeof device_memory === 'number' ? device_memory : (device_memory ? parseFloat(device_memory) : null),
      gpu_renderer: gpu_renderer || null,
      timezone: timezone || null,
      language: language || null,
      is_duplicate: isDuplicate,
      ip_address: ipAddress,
      country,
      city,
      device,
      browser,
      user_agent: requestUserAgent || null,
      is_bot: Boolean(is_bot),
      status: eventStatus,
      created_at: new Date().toISOString()
    };

    const isClick = event === 'click';
    let insertResult = isClick
      ? await supabase.from('clicks').insert([{
          tracking_key,
          website_id: websiteId,
          user_id: userId,
          landing_page: commonPayload.landing_page,
          gclid: gclid || null,
          utm_source: utm_source || null,
          utm_medium: utm_medium || null,
          utm_campaign: utm_campaign || null,
          keyword: keyword || null,
          ip_address: ipAddress,
          country,
          city,
          device,
          created_at: commonPayload.created_at
        }])
      : websiteId
        ? await supabase.from('page_views').insert([{
            ...commonPayload,
            page_url: commonPayload.landing_page
          }])
        : await supabase.from('impressions').insert([{
            tracking_key,
            user_id: userId,
            landing_page: commonPayload.landing_page,
            referrer: commonPayload.referrer,
            ip_address: ipAddress,
            country,
            city,
            created_at: commonPayload.created_at
          }]);

    if (insertResult.error && !isClick && websiteId) {
      console.warn('Fallback ke tabel impressions karena page_views error:', insertResult.error.message);
      insertResult = await supabase.from('impressions').insert([{
        tracking_key,
        user_id: userId,
        landing_page: commonPayload.landing_page,
        referrer: commonPayload.referrer,
        ip_address: ipAddress,
        country,
        city,
        created_at: commonPayload.created_at
      }]);
    }

    if (insertResult.error) {
      console.error('DALAM SUPABASE ERROR:', insertResult.error);
      return res.status(500).json({ success: false, supabase_error: insertResult.error.message });
    }

    // Forwarding ke Google Apps Script jika aktif & bukan BOT
    if (forwardingActive && appsScriptUrl && eventStatus !== 'BOT_FILTERED') {
      try {
        const forwardPayload = {
          event: event || 'page_view',
          ...commonPayload,
          gclid: gclid || null,
          utm_source: utm_source || null,
          utm_medium: utm_medium || null,
          utm_campaign: utm_campaign || null,
          keyword: keyword || null,
        };

        fetch(appsScriptUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(forwardPayload),
        }).catch(() => {});
      } catch (e) {}
    }

    console.log('BERHASIL MASUK SUPABASE!');
    return res.status(200).json({
      success: true,
      message: 'Data logged successfully',
      status: eventStatus,
      is_duplicate: isDuplicate
    });

  } catch (err: any) {
    console.error('CRASH API:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}