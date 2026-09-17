import type { IncomingMessage, ServerResponse } from 'http';
import { createClient } from '@supabase/supabase-js';

interface RequestWithBody extends IncomingMessage {
  body?: unknown;
}

interface JsonServerResponse extends ServerResponse {
  json: (data: unknown) => JsonServerResponse;
  status: (statusCode: number) => JsonServerResponse;
}

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


export default async function handler(
  req: RequestWithBody,
  res: JsonServerResponse
) {
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
    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body) as Record<string, unknown> | undefined;
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

    if ((event !== 'page_view' && event !== 'impression') && event !== 'click') {
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

    let website = null as null | {
      id: string;
      user_id: string;
      apps_script_url: string | null;
      forwarding_active: boolean;
      tracking_key: string;
    };

    const { data: websiteRow, error: websiteError } = await supabase
      .from('websites')
      .select('id, user_id, apps_script_url, forwarding_active, tracking_key')
      .eq('tracking_key', tracking_key)
      .maybeSingle();

    if (!websiteError && websiteRow) {
      website = websiteRow;
    }

    if (!website) {
      const { data: legacyProfile, error: legacyError } = await supabase
        .from('profiles')
        .select('id, user_id, apps_script_url, forwarding_active, tracking_key')
        .or(`tracking_key.eq.${tracking_key},user_id.eq.${tracking_key},id.eq.${tracking_key}`)
        .maybeSingle();

      if (!legacyError && legacyProfile) {
        website = {
          id: legacyProfile.id,
          user_id: legacyProfile.user_id,
          apps_script_url: legacyProfile.apps_script_url,
          forwarding_active: legacyProfile.forwarding_active,
          tracking_key: legacyProfile.tracking_key,
        };
      }
    }

    if (!website) {
      return res.status(404).json({ error: 'Invalid tracking key' });
    }

    const userAgentParam = typeof params.user_agent === 'string' ? params.user_agent : '';
    const userAgent = (req.headers['user-agent'] as string) || userAgentParam;
    const isMobile = /Mobile|Android|iPhone|iPod/i.test(userAgent);
    const isTablet = /iPad|Tablet/i.test(userAgent);
    const uaDevice = isTablet ? 'Tablet' : isMobile ? 'Mobile' : 'Desktop';
    let uaBrowser = 'Unknown';
    if (/Edg\//i.test(userAgent)) uaBrowser = 'Edge';
    else if (/OPR\//i.test(userAgent)) uaBrowser = 'Opera';
    else if (/Chrome\//i.test(userAgent)) uaBrowser = 'Chrome';
    else if (/Firefox\//i.test(userAgent)) uaBrowser = 'Firefox';
    else if (/Safari\//i.test(userAgent)) uaBrowser = 'Safari';

    const paramCountry = typeof params.country === 'string' ? params.country : undefined;
    const paramCity = typeof params.city === 'string' ? params.city : undefined;
    const country =
      (req.headers['cf-ipcountry'] as string) ||
      (req.headers['x-country-code'] as string) ||
      (req.headers['x-vercel-ip-country'] as string) ||
      paramCountry ||
      'Unknown';
    const city =
      (req.headers['cf-ipcity'] as string) ||
      (req.headers['x-vercel-ip-city'] as string) ||
      paramCity ||
      'Unknown';
    const ip =
      ((req.headers['x-forwarded-for'] as string) || '').split(',')[0]?.trim() ||
      (req.socket?.remoteAddress || '127.0.0.1');
    const paramLandingPage = typeof params.landing_page === 'string' ? params.landing_page : (typeof params.landingPage === 'string' ? params.landingPage : undefined);
    const landingPage =
      paramLandingPage ||
      (req.headers.referer ?? '');
    const referrer = typeof params.referrer === 'string' ? params.referrer : '';

    // Advanced Bot & Click Fraud Detection
    let isBot = Boolean(clientIsBot);
    const detectionReasons: string[] = Array.isArray(bot_reasons)
      ? bot_reasons.map((r) => String(r))
      : [];

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
        .eq('website_id', website.id)
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

    const device = typeof params.device === 'string' ? params.device : uaDevice;
    const utmSource = typeof params.utm_source === 'string' ? params.utm_source : null;
    const utmMedium = typeof params.utm_medium === 'string' ? params.utm_medium : null;
    const utmCampaign = typeof params.utm_campaign === 'string' ? params.utm_campaign : null;
    const keyword = typeof params.keyword === 'string' ? params.keyword : null;
    const clickTarget = typeof params.click_target === 'string' ? params.click_target : null;
    const targetText = typeof params.target_text === 'string' ? params.target_text : null;
    const sessionId = typeof session_id === 'string' ? session_id : null;
    const clientFingerprint = typeof fingerprint === 'string' ? fingerprint : null;

    const commonFields = {
      website_id: website.id,
      user_id: website.user_id,
      tracking_key,
      session_id: sessionId,
      fingerprint: clientFingerprint,
      landing_page: landingPage,
      page_url: typeof params.page_url === 'string' ? params.page_url : landingPage,
      referrer,
      country,
      city,
      ip_address: ip,
      device,
      os: typeof params.os === 'string' ? params.os : null,
      browser: uaBrowser,
      user_agent: userAgent,
      is_bot: isBot,
      bot_reasons: detectionReasons.join(',') || null,
      status: eventStatus,
    };

    if (event === 'page_view' || event === 'impression') {
      const pageViewPayload = {
        ...commonFields,
      };

      try {
        const { error } = await supabase.from('page_views').insert(pageViewPayload);
        if (error) throw error;
      } catch {
        const legacy = await supabase.from('impressions').insert(pageViewPayload);
        if (legacy.error) {
          return res.status(500).json({ error: 'Failed to save page view', details: legacy.error.message });
        }
      }
    } else {
      const { error } = await supabase.from('clicks').insert({
        ...commonFields,
        gclid,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        keyword,
        click_target: clickTarget,
        target_text: targetText,
      });
      if (error) {
        return res.status(500).json({ error: 'Failed to save click', details: error.message });
      }
    }

    // Forwarding ke Google Apps Script
    // BOT_FILTERED → tidak dikirim ke Sheets
    // SPAM_SUSPECT / OK → dikirim dengan field status agar Sheets bisa memberi warna merah
    const shouldForward =
      website.forwarding_active !== false &&
      Boolean(website.apps_script_url) &&
      eventStatus !== 'BOT_FILTERED';

    if (shouldForward && website.apps_script_url) {
      const forwardPayload = {
        event: event === 'page_view' ? 'page_view' : 'click',
        tracking_key,
        website_id: website.id,
        user_id: website.user_id,
        ip_address: ip,
        country,
        city,
        device,
        os: typeof params.os === 'string' ? params.os : null,
        browser: uaBrowser,
        landing_page: landingPage,
        page_url: typeof params.page_url === 'string' ? params.page_url : landingPage,
        referrer,
        gclid,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        keyword,
        click_target: clickTarget,
        target_text: targetText,
        timestamp: new Date().toISOString(),
        session_id: sessionId,
        fingerprint: clientFingerprint,
        status: eventStatus,
        spam_suspect: isSpamSuspect,
        detection_reasons: detectionReasons.join(',') || null,
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      fetch(website.apps_script_url, {
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return res.status(500).json({ error: message });
  }
}
