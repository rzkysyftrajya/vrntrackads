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

    if (event !== "impression" && event !== "click") {
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

    // Look up profile by tracking_key, user_id, or id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, user_id, apps_script_url, forwarding_active")
      .or(`tracking_key.eq.${tracking_key},user_id.eq.${tracking_key},id.eq.${tracking_key}`)
      .maybeSingle();

    if (profileError || !profile) {
      console.error(`[Tracking Error] Key not found: ${tracking_key}`, profileError);
      return jsonResponse({ error: `Invalid tracking key: ${tracking_key}` }, 404);
    }

    const resolvedUserId = profile.user_id || profile.id;
    const userAgent = req.headers.get("user-agent") || params.user_agent || "";
    const { device: uaDevice, browser: uaBrowser } = parseUserAgent(userAgent);

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

    const commonFields = {
      user_id: resolvedUserId,
      tracking_key,
      device: params.device || uaDevice,
      ip_address: ip,
      country,
      city,
      landing_page: landingPage,
    };

    // Save event to database
    if (event === "impression") {
      const { error } = await supabase.from("impressions").insert({
        ...commonFields,
        browser: uaBrowser,
        referrer,
      });
      if (error) {
        console.error("[Insert Impression Error]", error);
        return jsonResponse({ error: "Failed to save impression", details: error.message }, 500);
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
        console.error("[Insert Click Error]", error);
        return jsonResponse({ error: "Failed to save click", details: error.message }, 500);
      }
    }

    // -------------------------------------------------------------
    // FORWARDING TO GOOGLE APPS SCRIPT
    // Protection: STRICT FILTERING (Bots & duplicate clicks are NOT forwarded!)
    // -------------------------------------------------------------
    const shouldForward =
      profile.forwarding_active !== false &&
      Boolean(profile.apps_script_url) &&
      !isBot &&
      !isDuplicateGclid;

    if (shouldForward && profile.apps_script_url) {
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
      };

      const forwardPromise = (async () => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 8000);
          
          // Using text/plain & redirect: follow prevents Apps Script CORS / 302 blocks
          const res = await fetch(profile.apps_script_url!, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify(forwardPayload),
            redirect: "follow",
            signal: controller.signal,
          });
          clearTimeout(timeout);
          console.log(`[Forwarding Success] Status ${res.status} to Apps Script`);
        } catch (err: any) {
          console.warn(`[Forwarding Warning] Failed to forward to Apps Script: ${err?.message || err}`);
        }
      })();

      // @ts-ignore
      if (typeof EdgeRuntime !== "undefined" && EdgeRuntime.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(forwardPromise);
      } else {
        forwardPromise.catch(() => {});
      }
    } else if (isBot || isDuplicateGclid) {
      console.log(`[Bot Filtered] Event ${event} withheld from Google Sheets. Reasons: ${detectionReasons.join(", ")}`);
    }

    return jsonResponse({
      success: true,
      event,
      filtered_bot: isBot || isDuplicateGclid,
    });
  } catch (err: any) {
    return jsonResponse({ error: err.message }, 500);
  }
});