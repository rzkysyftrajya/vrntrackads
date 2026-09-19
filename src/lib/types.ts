export type DateFilter = 'today' | 'yesterday' | '7days' | 'custom';

export interface Website {
  id: string;
  user_id: string;
  name: string;
  domain: string;
  tracking_key: string;
  apps_script_url: string | null;
  forwarding_active: boolean;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  apps_script_url: string | null;
  tracking_key: string;
  forwarding_active: boolean;
  website_id?: string | null;
  created_at: string;
}

export interface Impression {
  id: string;
  website_id?: string | null;
  user_id: string | null;
  tracking_key: string | null;
  landing_page: string | null;
  page_url?: string | null;
  referrer: string | null;
  country: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  ip_address: string | null;
  fingerprint?: string | null;
  screen_resolution?: string | null;
  cpu_cores?: number | null;
  device_memory?: number | null;
  gpu_renderer?: string | null;
  timezone?: string | null;
  language?: string | null;
  is_duplicate?: boolean;
  is_bot?: boolean;
  bot_reasons?: string | null;
  status?: string | null;
  created_at: string;
}

export interface Click {
  id: string;
  website_id?: string | null;
  user_id: string | null;
  tracking_key: string | null;
  gclid: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  keyword: string | null;
  device: string | null;
  ip_address: string | null;
  country: string | null;
  city: string | null;
  browser?: string | null;
  landing_page: string | null;
  fingerprint?: string | null;
  screen_resolution?: string | null;
  cpu_cores?: number | null;
  device_memory?: number | null;
  gpu_renderer?: string | null;
  timezone?: string | null;
  language?: string | null;
  is_duplicate?: boolean;
  is_bot?: boolean;
  status?: string | null;
  created_at: string;
}

export interface TimelinePoint {
  date: string;
  impressions: number;
  clicks: number;
}

export interface LiveFeedItem {
  id: string;
  type: 'impression' | 'click';
  country: string;
  city: string;
  device: string;
  browser?: string | null;
  ip_address?: string | null;
  gclid?: string | null;
  utm_source?: string | null;
  keyword?: string | null;
  landing_page: string;
  fingerprint?: string | null;
  screen_resolution?: string | null;
  cpu_cores?: number | null;
  device_memory?: number | null;
  gpu_renderer?: string | null;
  timezone?: string | null;
  language?: string | null;
  is_duplicate?: boolean;
  is_bot?: boolean;
  status?: string | null;
  created_at: string;
  forwarding_status?: string | null;
}
