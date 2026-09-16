import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { createClient } from '@supabase/supabase-js';

function trackingApiPlugin(env: Record<string, string>): Plugin {
  return {
    name: 'tracking-api-plugin',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];
        if (url === '/api/public/track' || url === '/functions/v1/track') {
          // Set CORS headers
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Client-Info, Apikey');

          if (req.method === 'OPTIONS') {
            res.statusCode = 200;
            res.end();
            return;
          }

          if (req.method !== 'POST') {
            res.statusCode = 405;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
          }

          try {
            let bodyStr = '';
            for await (const chunk of req) {
              bodyStr += chunk;
            }
            const body = JSON.parse(bodyStr || '{}');
            const { event, tracking_key, ...params } = body;

            if (!tracking_key || !event) {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Missing tracking_key or event' }));
              return;
            }

            if (event !== 'impression' && event !== 'click') {
              res.statusCode = 400;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Invalid event type' }));
              return;
            }

            const supabaseUrl =
              env.VITE_SUPABASE_URL ||
              process.env.VITE_SUPABASE_URL ||
              'https://qtgbuacxiuntczeaqlqi.supabase.co';

            const serviceKey =
              env.SUPABASE_SERVICE_ROLE_KEY ||
              process.env.SUPABASE_SERVICE_ROLE_KEY ||
              env.VITE_SUPABASE_ANON_KEY ||
              process.env.VITE_SUPABASE_ANON_KEY ||
              '';

            const supabase = createClient(supabaseUrl, serviceKey, {
              auth: { persistSession: false },
            });

            // Look up profile by tracking_key
            const { data: profile, error: profileError } = await supabase
              .from('profiles')
              .select('id, user_id, apps_script_url, forwarding_active')
              .eq('tracking_key', tracking_key)
              .maybeSingle();

            if (profileError || !profile) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ error: 'Invalid tracking key' }));
              return;
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
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Failed to save impression', details: error.message }));
                return;
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
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: 'Failed to save click', details: error.message }));
                return;
              }
            }

            // Async forward to apps_script_url
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

            res.statusCode = 200;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success: true, event }));
            return;
          } catch (err: any) {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ error: err?.message || 'Internal server error' }));
            return;
          }
        }
        next();
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), trackingApiPlugin(env)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    optimizeDeps: {
      exclude: ['lucide-react'],
    },
  };
});
