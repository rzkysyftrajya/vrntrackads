import { createClient } from '@supabase/supabase-js';

const BOT_UA_REGEX = /bot|crawler|spider|headless|puppeteer|selenium|playwright|phantom|curl|wget|python|postman|node-fetch|axios|go-http-client|apachebench|ahrefs|semrush|petalbot|bytespider|yandex|facebookexternalhit|bingbot|googlebot|slurp|duckduckbot/i;

interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  if (rateLimitMap.size > 5000) {
    for (const [k, v] of rateLimitMap.entries()) {
      if (v.resetAt < now) rateLimitMap.delete(k);
    }
  }

  const record = rateLimitMap.get(key);
  if (!record || record.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  record.count += 1;
  return true;
}

// ─── Rapid-click spam detection (per IP, < 10 detik) ────────────────────────
const SPAM_CLICK_WINDOW_MS = 10 * 1000;
const lastClickTimestampMap = new Map<string, number>();

function checkSpamSuspect(ip: string): boolean {
  const now = Date.now();
  const lastTs = lastClickTimestampMap.get(ip);
  lastClickTimestampMap.set(ip, now);

  if (lastClickTimestampMap.size > 5000) {
    const cutoff = now - SPAM_CLICK_WINDOW_MS * 10;
    for (const [k, v] of lastClickTimestampMap.entries()) {
      if (v < cutoff) lastClickTimestampMap.delete(k);
    }
  }

  if (lastTs !== undefined && now - lastTs < SPAM_CLICK_WINDOW_MS) {
    return true; // SPAM_SUSPECT
  }
  return false;
}


export default async function handler(req: any, res: any) {
  // CORS Headers
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
    const {
      event,
      tracking_key,
      session_id,
      fingerprint,
      is_bot: clientIsBot,
      bot_reasons,
      ...params
    } = body || {};

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
      .or(`tracking_key.eq.${tracking_key},user_id.eq.${tracking_key},id.eq.${tracking_key}`)
      .maybeSingle();

    if (profileError || !profile) {
      return res.status(404).json({ error: 'Invalid tracking key' });
    }

    const userAgent = (req.headers['user-agent'] as string) || params.user_agent || '';
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

    // Advanced Bot & Click Fraud Detection
    let isBot = Boolean(clientIsBot);
    const detectionReasons: string[] = Array.isArray(bot_reasons) ? [...bot_reasons] : [];

    if (BOT_UA_REGEX.test(userAgent)) {
      isBot = true;
      detectionReasons.push('server_ua_crawler');
    }

    const rateLimitKey = `${ip}_${session_id || fingerprint || 'anon'}`;
    if (!checkRateLimit(rateLimitKey)) {
      isBot = true;
      detectionReasons.push('rate_limit_exceeded');
    }

    let isDuplicateGclid = false;
    const gclid = params.gclid ? String(params.gclid).trim() : null;

    if (event === 'click' && gclid) {
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: existingClick } = await supabase
        .from('clicks')
        .select('id')
        .eq('tracking_key', tracking_key)
        .eq('gclid', gclid)
        .gte('created_at', oneDayAgo)
        .limit(1)
        .maybeSingle();

      if (existingClick) {
        isDuplicateGclid = true;
        detectionReasons.push('duplicate_gclid');
      }
    }

    // 4. Rapid-click Spam Detection (per IP, < 10 detik)
    let isSpamSuspect = false;
    if (event === 'click' && !isBot) {
      isSpamSuspect = checkSpamSuspect(ip);
      if (isSpamSuspect) {
        detectionReasons.push('rapid_click_spam');
      }
    }

    // Tentukan status akhir event
    const eventStatus = isBot || isDuplicateGclid
      ? 'BOT_FILTERED'
      : isSpamSuspect
        ? 'SPAM_SUSPECT'
        : 'OK';

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
        gclid,
        utm_source: params.utm_source || null,
        utm_medium: params.utm_medium || null,
        utm_campaign: params.utm_campaign || null,
        keyword: params.keyword || null,
      });
      if (error) {
        return res.status(500).json({ error: 'Failed to save click', details: error.message });
      }
    }

    // Forwarding ke Google Apps Script
    // BOT_FILTERED → tidak dikirim ke Sheets
    // SPAM_SUSPECT / OK → dikirim dengan field status agar Sheets bisa memberi warna merah
    const shouldForward =
      profile.forwarding_active !== false &&
      Boolean(profile.apps_script_url) &&
      eventStatus !== 'BOT_FILTERED';

    if (shouldForward && profile.apps_script_url) {
      const forwardPayload = {
        event,
        tracking_key,
        user_id: profile.user_id,
        ip_address: ip,
        country,
        city,
        device: params.device || uaDevice,
        browser: uaBrowser,
        landing_page: landingPage,
        referrer,
        gclid,
        utm_source: params.utm_source || null,
        utm_medium: params.utm_medium || null,
        utm_campaign: params.utm_campaign || null,
        keyword: params.keyword || null,
        timestamp: new Date().toISOString(),
        session_id: session_id || null,
        fingerprint: fingerprint || null,
        click_target: params.click_target || null,
        target_text: params.target_text || null,
        // ── Status anti-spam ──────────────────────────────────────────────
        status: eventStatus,                          // "OK" | "SPAM_SUSPECT"
        spam_suspect: isSpamSuspect,                  // true → warna baris MERAH di Sheets
        detection_reasons: detectionReasons.join(',') || null,
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      fetch(profile.apps_script_url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(forwardPayload),
        redirect: 'follow',
        signal: controller.signal,
      })
        .then(() => clearTimeout(timeout))
        .catch(() => {});
    }

    return res.status(200).json({
      success: true,
      event,
      status: eventStatus,
      spam_suspect: isSpamSuspect,
      filtered_bot: isBot || isDuplicateGclid,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Internal server error' });
  }
}
