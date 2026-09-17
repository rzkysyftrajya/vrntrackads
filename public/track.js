import { createClient } from '@supabase/supabase-js';

// Inisialisasi Supabase dengan Service Role Key agar bypass RLS
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  { auth: { persistSession: false } }
);

export default async function handler(req: any, res: any) {
  // 1. Handling CORS Preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    // Destrukturisasi aman untuk mencegah crash jika ada field undefined
    const {
      tracking_key,
      event,
      page_url,
      referrer,
      session_id,
      device,
      browser,
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

    // 2. Simpan ke Supabase (Sesuaikan nama tabel kamu, contoh: 'clicks' atau 'events')
    const { data, error } = await supabase
      .from('clicks') // Ganti dengan nama tabel tracking kamu di Supabase
      .insert([
        {
          tracking_key,
          event_type: event || 'page_view',
          page_url: page_url || '',
          referrer: referrer || null,
          session_id: session_id || null,
          device: device || 'Desktop',
          browser: browser || 'Unknown',
          gclid: gclid || null,
          utm_source: utm_source || null,
          utm_medium: utm_medium || null,
          utm_campaign: utm_campaign || null,
          utm_content: utm_content || null,
          utm_term: utm_term || null,
          keyword: keyword || null,
          user_agent: user_agent || null,
          element_text: element_text || null,
          element_href: element_href || null,
          created_at: new Date().toISOString()
        }
      ]);

    if (error) {
      console.error('Supabase Insert Error:', error);
      return res.status(500).json({ success: false, error: error.message });
    }

    return res.status(200).json({ success: true, data });
  } catch (err: any) {
    console.error('API Route Crash:', err);
    return res.status(500).json({ success: false, error: err.message || 'Internal Error' });
  }
}