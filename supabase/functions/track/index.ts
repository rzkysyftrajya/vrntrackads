import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

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
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json();
    const { event, tracking_key, ...params } = body;

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

    // Look up the profile by tracking_key to get user_id + forwarding config
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, user_id, apps_script_url, forwarding_active")
      .eq("tracking_key", tracking_key)
      .maybeSingle();

    if (profileError || !profile) {
      return jsonResponse({ error: "Invalid tracking key" }, 404);
    }

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

    const commonFields = {
      user_id: profile.user_id,
      tracking_key,
      device: params.device || uaDevice,
      ip_address: ip,
      country,
      city,
      landing_page: landingPage,
    };

    if (event === "impression") {
      const { error } = await supabase.from("impressions").insert({
        ...commonFields,
        browser: uaBrowser,
        referrer,
      });
      if (error) {
        return jsonResponse({ error: "Failed to save impression", details: error.message }, 500);
      }
    } else {
      const { error } = await supabase.from("clicks").insert({
        ...commonFields,
        gclid: params.gclid || null,
        utm_source: params.utm_source || null,
        utm_medium: params.utm_medium || null,
        utm_campaign: params.utm_campaign || null,
        keyword: params.keyword || null,
      });
      if (error) {
        return jsonResponse({ error: "Failed to save click", details: error.message }, 500);
      }
    }

    // Async forward to apps_script_url with 5s timeout
    if (profile.forwarding_active && profile.apps_script_url) {
      const forwardPayload = { event, tracking_key, ...params };
      const forwardPromise = (async () => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 5000);
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
    }

    return jsonResponse({ success: true, event });
  } catch (err: any) {
    return jsonResponse({ error: err.message }, 500);
  }
});
