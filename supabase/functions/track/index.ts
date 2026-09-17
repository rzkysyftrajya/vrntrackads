import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, Authorization, X-Client-Info, Apikey, Content-Type",
};

// Known crawler / bot regex on server-side
const BOT_UA_REGEX = /bot|crawler|spider|headless|puppeteer|selenium|playwright|phantom|curl|wget|python|postman|node-fetch|axios|go-http-client|apachebench|ahrefs|semrush|petalbot|bytespider|yandex|facebookexternalhit|bingbot|googlebot|slurp|duckduckbot/i;

// In-memory rate limiter per worker instance (Sliding window)
interface RateLimitRecord {
  count: number;
  resetAt: number;
}
const rateLimitMap = new Map<string, RateLimitRecord>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 30; // 30 req / min per IP or Session

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  // Occasional cleanup of stale entries
  if (rateLimitMap.size > 5000) {
    for (const [k, v] of rateLimitMap.entries()) {
      if (v.resetAt < now) rateLimitMap.delete(k);
    }
  }

  const record = rateLimitMap.get(key);
  if (!record || record.resetAt < now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true; // allowed
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false; // rate limit exceeded (bot/fraud suspected)
  }

  record.count += 1;
  return true;
}

// ─── Rapid-click spam detection (per IP, per event type) ────────────────────
// Jika IP yang sama mengirim event 'click' < 10 detik setelah klik sebelumnya,
// tandai sebagai SPAM_SUSPECT.
const SPAM_CLICK_WINDOW_MS = 10 * 1000; // 10 detik
const lastClickTimestampMap = new Map<string, number>(); // ip → timestamp ms

function checkSpamSuspect(ip: string): boolean {
  const now = Date.now();
  const lastTs = lastClickTimestampMap.get(ip);
  lastClickTimestampMap.set(ip, now);

  // Cleanup map agar tidak membengkak
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


function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function parseUserAgent(ua: string): { device: string; browser: string } {
  const device = /iPad|Tablet/i.test(ua)
    ? "Tablet"
    : /Mobile|Android|iPhone|iPod/i.test(ua)
      ? "Mobile"
      : "Desktop";

  let browser = "Unknown";
  if (/Edg\//i.test(ua)) browser = "Edge";
  else if (/OPR\//i.test(ua)) browser = "Opera";
  else if (/Chrome\//i.test(ua)) browser = "Chrome";
  else if (/Firefox\//i.test(ua)) browser = "Firefox";
  else if (/Safari\//i.test(ua)) browser = "Safari";

  return { device, browser };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { event, tracking_key, session_id, fingerprint, is_bot: clientIsBot, bot_reasons, ...params } = body;

    if (!tracking_key || !event) {
      return jsonResponse({ error: "Missing tracking_key or event" }, 400);
    }

    if ((event !== "page_view" && event !== "impression") && event !== "click") {
      return jsonResponse({ error: "Invalid event type" }, 400);
    }

    const supabaseUrl =
      Deno.env.get("SUPABASE_URL") ||
      Deno.env.get("VITE_SUPABASE_URL") ||
      "https://qtgbuacxiuntczeaqlqi.supabase.co";

    const supabaseServiceKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_ANON_KEY") ||
      Deno.env.get("VITE_SUPABASE_ANON_KEY") ||
      "";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let profile = null as null | {
      id: string;
      user_id: string;
      apps_script_url: string | null;
      forwarding_active: boolean;
      tracking_key: string;
    };

    const { data: websiteProfile, error: websiteError } = await supabase
      .from("websites")
      .select("id, user_id, apps_script_url, forwarding_active, tracking_key")
      .eq("tracking_key", tracking_key)
      .maybeSingle();

    if (!websiteError && websiteProfile) {
      profile = websiteProfile;
    }

    if (!profile) {
      const { data: legacyProfile, error: legacyError } = await supabase
        .from("profiles")
        .select("id, user_id, apps_script_url, forwarding_active, tracking_key")
        .or(`tracking_key.eq.${tracking_key},user_id.eq.${tracking_key},id.eq.${tracking_key}`)
        .maybeSingle();

      if (!legacyError && legacyProfile) {
        profile = {
          id: legacyProfile.id,
          user_id: legacyProfile.user_id,
          apps_script_url: legacyProfile.apps_script_url,
          forwarding_active: legacyProfile.forwarding_active,
          tracking_key: legacyProfile.tracking_key,
        };
      }
    }

    if (!profile) {
      return jsonResponse({ error: "Invalid tracking key" }, 404);
    }

    const resolvedUserId = profile.user_id || profile.id;
    const userAgent = req.headers.get("user-agent") || "";
    const { device: uaDevice, browser: uaBrowser } = parseUserAgent(userAgent);

    // Geo from CF / Vercel headers
    const country =
      req.headers.get("x-vercel-ip-country") ||
      req.headers.get("cf-ipcountry") ||
      req.headers.get("x-country-code") ||
      params.country ||
      "Unknown";
    const city =
      req.headers.get("x-vercel-ip-city") ||
      req.headers.get("cf-ipcity") ||
      params.city ||
      "Unknown";

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "0.0.0.0";

    const landingPage =
      params.landing_page ||
      params.landingPage ||
      (req.headers.get("referer") ?? "");
    const referrer = params.referrer || "";

    // -------------------------------------------------------------
    // ADVANCED BOT & CLICK FRAUD DETECTION
    // -------------------------------------------------------------
    let isBot = Boolean(clientIsBot);
    const detectionReasons: string[] = Array.isArray(bot_reasons) ? [...bot_reasons] : [];

    // 1. Server-side User Agent inspection
    if (BOT_UA_REGEX.test(userAgent)) {
      isBot = true;
      detectionReasons.push("server_ua_crawler");
    }

    // 2. In-memory Rate Limiting (per IP & per Session/Fingerprint)
    const rateLimitKey = `${ip}_${session_id || fingerprint || "anon"}`;
    const withinRateLimit = checkRateLimit(rateLimitKey);
    if (!withinRateLimit) {
      isBot = true;
      detectionReasons.push("rate_limit_exceeded");
    }

    // 3. GCLID Deduplication Check (for Clicks)
    let isDuplicateGclid = false;
    const gclid = params.gclid ? String(params.gclid).trim() : null;

    if (event === "click" && gclid) {
      // Check if this gclid already exists in clicks for this user/tracking key in last 24h
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: existingClick } = await supabase
        .from("clicks")
        .select("id")
        .eq("tracking_key", tracking_key)
        .eq("gclid", gclid)
        .gte("created_at", oneDayAgo)
        .limit(1)
        .maybeSingle();

      if (existingClick) {
        isDuplicateGclid = true;
        detectionReasons.push("duplicate_gclid");
      }
    }

    // 4. Rapid-click Spam Detection (per IP, < 10 detik)
    let isSpamSuspect = false;
    if (event === "click" && !isBot) {
      isSpamSuspect = checkSpamSuspect(ip);
      if (isSpamSuspect) {
        detectionReasons.push("rapid_click_spam");
      }
    }

    // Tentukan status akhir event
    const eventStatus = isBot || isDuplicateGclid
      ? "BOT_FILTERED"
      : isSpamSuspect
        ? "SPAM_SUSPECT"
        : "OK";

    const commonFields = {
      website_id: profile.id,
      user_id: profile.user_id,
      tracking_key,
      device: params.device || uaDevice,
      ip_address: ip,
      country,
      city,
      landing_page: landingPage,
    };

    // Save event to database
    if (event === "page_view" || event === "impression") {
      const pageViewPayload = {
        ...commonFields,
        browser: uaBrowser,
        referrer,
      };

      try {
        const { error } = await supabase.from("page_views").insert(pageViewPayload);
        if (error) throw error;
      } catch {
        const legacy = await supabase.from("impressions").insert(pageViewPayload);
        if (legacy.error) {
          return jsonResponse({ error: "Failed to save page view", details: legacy.error.message }, 500);
        }
      }
    } else {
      const { error } = await supabase.from("clicks").insert({
        ...commonFields,
        gclid,
        utm_source: params.utm_source || null,
        utm_medium: params.utm_medium || null,
        utm_campaign: params.utm_campaign || null,
        keyword: params.keyword || null,
      });
      if (error) {
        return jsonResponse({ error: "Failed to save click", details: error.message }, 500);
      }
    }

    // Forward to Google Apps Script URL
    // BOT_FILTERED → tidak dikirim ke Sheets
    // SPAM_SUSPECT / OK → dikirim, dengan field status agar Sheets bisa memberi warna
    const shouldForwardToSheets =
      profile.forwarding_active !== false &&
      profile.apps_script_url &&
      eventStatus !== "BOT_FILTERED";

    if (shouldForwardToSheets) {
      const forwardPayload = {
        event,
        tracking_key,
        user_id: resolvedUserId,
        ip_address: ip,
        country,
        city,
        device: params.device || uaDevice,
        browser: uaBrowser,
        landing_page: landingPage,
        referrer,
        gclid: params.gclid || null,
        utm_source: params.utm_source || null,
        utm_medium: params.utm_medium || null,
        utm_campaign: params.utm_campaign || null,
        keyword: params.keyword || null,
        timestamp: new Date().toISOString(),
        // ── Status anti-spam ──────────────────────────────────────────────
        status: eventStatus,                          // "OK" | "SPAM_SUSPECT"
        spam_suspect: isSpamSuspect,                  // true → warna baris MERAH di Sheets
        detection_reasons: detectionReasons.join(",") || null,
        ...params,
      };

      const forwardPromise = (async () => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);

          // Menggunakan redirect: 'follow' dan text/plain agar tidak diblokir Apps Script CORS / 302
          await fetch(profile.apps_script_url!, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(forwardPayload),
            signal: controller.signal,
          });
          clearTimeout(timeout);
        } catch {
          // forwarding failure is non-fatal
        }
      })();

      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
        EdgeRuntime.waitUntil(forwardPromise);
      }
    } else if (eventStatus === "BOT_FILTERED") {
      console.log(`[Bot Filtered] Event ${event} withheld from Google Sheets. Reasons: ${detectionReasons.join(", ")}`);
    }

    return jsonResponse({
      success: true,
      event,
      status: eventStatus,
      spam_suspect: isSpamSuspect,
      filtered_bot: isBot || isDuplicateGclid,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    return jsonResponse({ error: message }, 500);
  }
});
