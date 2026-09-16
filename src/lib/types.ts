export interface Profile {
  id: string;
  user_id: string;
  display_name: string | null;
  apps_script_url: string | null;
  tracking_key: string;
  forwarding_active: boolean;
  created_at: string;
}

export interface Impression {
  id: string;
  user_id: string | null;
  tracking_key: string | null;
  landing_page: string | null;
  referrer: string | null;
  country: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface Click {
  id: string;
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
  landing_page: string | null;
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
  landing_page: string;
  created_at: string;
}
