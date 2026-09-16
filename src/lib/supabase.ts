import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://qtgbuacxiuntczeaqlqi.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_mtB461pYvcwJAtH50KlZrw_S35zH6Pi';

const supabaseUrl =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  DEFAULT_SUPABASE_URL;

const supabaseAnonKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  DEFAULT_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('placeholder')
);

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
