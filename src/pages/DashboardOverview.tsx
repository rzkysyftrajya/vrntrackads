import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import type { TimelinePoint, LiveFeedItem, DateFilter, Impression, Click, Website } from '@/lib/types';
import type { PageId } from '@/components/Layout';
import {
  Eye,
  MousePointerClick,
  TrendingUp,
  Plug,
  Activity,
  Smartphone,
  Globe,
  Clock,
  Zap,
  RefreshCw,
  ArrowRight,
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertCircle,
  Tag,
  Monitor,
  Terminal,
  Calendar,
  ChevronDown,
} from 'lucide-react';

import {
  getDateRangeBounds,
  formatDisplayDateRange,
  formatTimelineLabel,
} from '@/lib/dateUtils';

interface DashboardStats {
  totalImpressions: number;
  totalClicks: number;
  ctr: number;
  integrationStatus: 'Connected' | 'Disconnected';
}

interface DashboardOverviewProps {
  onNavigate?: (page: PageId) => void;
}

export default function DashboardOverview({ onNavigate }: DashboardOverviewProps) {
  const { profile } = useAuth();
  const { notify } = useToast();
  const [timeline, setTimeline] = useState<TimelinePoint[]>([]);
  const [liveFeed, setLiveFeed] = useState<LiveFeedItem[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    totalImpressions: 0,
    totalClicks: 0,
    ctr: 0,
    integrationStatus: 'Disconnected',
  });
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [chartReady, setChartReady] = useState(false);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(null);
  const chartAnimKey = useRef(0);

  // Date Range Filter State ('today', 'yesterday', '7days', 'custom')
  const [dateFilter, setDateFilter] = useState<DateFilter>('today');
  const [customStartDate, setCustomStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [customEndDate, setCustomEndDate] = useState(() => {
    return new Date().toISOString().slice(0, 10);
  });

  const trackingKey = profile?.tracking_key || profile?.user_id;
  const activeWebsite = websites.find((site) => site.id === selectedWebsiteId) ?? websites[0] ?? null;

  if (activeWebsite) {
    // Keep selected website context available for future multi-site UI widgets.
  }

  useEffect(() => {
    if (!profile?.user_id) {
      setWebsites([]);
      setSelectedWebsiteId(null);
      return;
    }

    let isMounted = true;

    supabase
      .from('websites')
      .select('*')
      .eq('user_id', profile.user_id)
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!isMounted || error) return;

        const nextWebsites = (data || []) as Website[];
        setWebsites(nextWebsites);
        setSelectedWebsiteId((current) => {
          if (current && nextWebsites.some((site) => site.id === current)) return current;
          return nextWebsites[0]?.id ?? null;
        });
      });

    return () => {
      isMounted = false;
    };
  }, [profile?.user_id]);

  const loadData = useCallback(async () => {
    if (!trackingKey) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const bounds = getDateRangeBounds(dateFilter, customStartDate, customEndDate);

      const pageViewsTable = 'page_views';
      const websiteScopedQuery = selectedWebsiteId
        ? supabase.from(pageViewsTable).select('*').eq('website_id', selectedWebsiteId)
        : supabase.from(pageViewsTable).select('*').or(`user_id.eq.${profile?.user_id},tracking_key.eq.${trackingKey}`);

      const websiteScopedClickQuery = selectedWebsiteId
        ? supabase.from('clicks').select('*').eq('website_id', selectedWebsiteId)
        : supabase.from('clicks').select('*').or(`user_id.eq.${profile?.user_id},tracking_key.eq.${trackingKey}`);

      const impQuery = websiteScopedQuery
        .gte('created_at', bounds.startIso)
        .lte('created_at', bounds.endIso)
        .order('created_at', { ascending: false })
        .limit(500);

      const clkQuery = websiteScopedClickQuery
        .gte('created_at', bounds.startIso)
        .lte('created_at', bounds.endIso)
        .order('created_at', { ascending: false })
        .limit(500);

      let [{ data: impressions, error: impErr }, { data: clicks, error: clkErr }] =
        await Promise.all([impQuery, clkQuery]);

      // Keep the dashboard visible when the selected website context is stale
      // or the event was created with the legacy profile tracking key.
      if (selectedWebsiteId && !impErr && !(impressions?.length) && !clkErr && !(clicks?.length)) {
        const [fallbackImp, fallbackClk] = await Promise.all([
          supabase.from(pageViewsTable).select('*')
            .or(`user_id.eq.${profile?.user_id},tracking_key.eq.${trackingKey}`)
            .gte('created_at', bounds.startIso)
            .lte('created_at', bounds.endIso)
            .order('created_at', { ascending: false })
            .limit(500),
          supabase.from('clicks').select('*')
            .or(`user_id.eq.${profile?.user_id},tracking_key.eq.${trackingKey}`)
            .gte('created_at', bounds.startIso)
            .lte('created_at', bounds.endIso)
            .order('created_at', { ascending: false })
            .limit(500),
        ]);
        if (fallbackImp.data?.length) impressions = fallbackImp.data;
        if (fallbackClk.data?.length) clicks = fallbackClk.data;
      }

      // Fallback: in case Supabase schema uses 'timestamp' column name instead of 'created_at'
      if (impErr && (impErr.message?.includes('page_views') || impErr.message?.includes('impressions') || impErr.message?.includes('created_at') || (impErr as { code?: string }).code === '42703' || (impErr as { code?: string }).code === '42P01')) {
        const fallbackImp = selectedWebsiteId
          ? await supabase.from('impressions').select('*').eq('website_id', selectedWebsiteId).gte('timestamp', bounds.startIso).lte('timestamp', bounds.endIso).order('timestamp', { ascending: false }).limit(500)
          : await supabase.from('impressions').select('*').or(`user_id.eq.${profile?.user_id},tracking_key.eq.${trackingKey}`).gte('timestamp', bounds.startIso).lte('timestamp', bounds.endIso).order('timestamp', { ascending: false }).limit(500);
        impressions = fallbackImp.data;
        impErr = fallbackImp.error;
      }

      if (clkErr && (clkErr.message?.includes('created_at') || (clkErr as { code?: string }).code === '42703')) {
        const fallbackClk = selectedWebsiteId
          ? await supabase.from('clicks').select('*').eq('website_id', selectedWebsiteId).gte('timestamp', bounds.startIso).lte('timestamp', bounds.endIso).order('timestamp', { ascending: false }).limit(500)
          : await supabase.from('clicks').select('*').or(`user_id.eq.${profile?.user_id},tracking_key.eq.${trackingKey}`).gte('timestamp', bounds.startIso).lte('timestamp', bounds.endIso).order('timestamp', { ascending: false }).limit(500);
        clicks = fallbackClk.data;
        clkErr = fallbackClk.error;
      }

      if (impErr) console.warn('Impressions fetch error:', impErr.message);
      if (clkErr) console.warn('Clicks fetch error:', clkErr.message);

      const impList = (impressions || []) as (Impression & { timestamp?: string })[];
      const clkList = (clicks || []) as (Click & { timestamp?: string })[];
      const impCount = impList.length;
      const clkCount = clkList.length;

      // Calculate Stats
      setStats({
        totalImpressions: impCount,
        totalClicks: clkCount,
        ctr: impCount > 0 ? (clkCount / impCount) * 100 : 0,
        integrationStatus: profile?.apps_script_url ? 'Connected' : 'Disconnected',
      });

      // Build timeline from real data according to selected date filter
      const days: Record<string, { impressions: number; clicks: number }> = {};
      const isSingleDay =
        dateFilter === 'today' ||
        dateFilter === 'yesterday' ||
        bounds.start.toISOString().slice(0, 10) === bounds.end.toISOString().slice(0, 10);

      if (isSingleDay) {
        // Hourly buckets (3-hour intervals: 00:00, 03:00, ..., 21:00)
        for (let h = 0; h < 24; h += 3) {
          const slot = `${String(h).padStart(2, '0')}:00`;
          days[slot] = { impressions: 0, clicks: 0 };
        }

        impList.forEach((r) => {
          const rawDate = r.created_at || r.timestamp;
          if (rawDate) {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
              const h = Math.floor(d.getHours() / 3) * 3;
              const slot = `${String(h).padStart(2, '0')}:00`;
              if (days[slot]) days[slot].impressions++;
            }
          }
        });

        clkList.forEach((r) => {
          const rawDate = r.created_at || r.timestamp;
          if (rawDate) {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
              const h = Math.floor(d.getHours() / 3) * 3;
              const slot = `${String(h).padStart(2, '0')}:00`;
              if (days[slot]) days[slot].clicks++;
            }
          }
        });
      } else {
        // Daily buckets
        const startDay = new Date(bounds.start);
        startDay.setHours(0, 0, 0, 0);
        const endDay = new Date(bounds.end);
        endDay.setHours(0, 0, 0, 0);

        const cur = new Date(startDay);
        let count = 0;
        while (cur <= endDay && count < 31) {
          const key = cur.toISOString().slice(0, 10);
          days[key] = { impressions: 0, clicks: 0 };
          cur.setDate(cur.getDate() + 1);
          count++;
        }

        impList.forEach((r) => {
          const rawDate = r.created_at || r.timestamp || '';
          const key = rawDate.slice(0, 10);
          if (days[key]) days[key].impressions++;
        });

        clkList.forEach((r) => {
          const rawDate = r.created_at || r.timestamp || '';
          const key = rawDate.slice(0, 10);
          if (days[key]) days[key].clicks++;
        });
      }

      const newTimeline = Object.entries(days).map(([date, v]) => ({ date, ...v }));
      chartAnimKey.current += 1;
      setChartReady(false);
      setTimeline(newTimeline);
      // Defer so React resets height to 0 first, then animates up
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setChartReady(true));
      });

      const isForwarding = Boolean(profile?.apps_script_url && profile?.forwarding_active);

      // Combine feed items
      const combinedFeed: LiveFeedItem[] = [
        ...impList.map((r) => ({
          id: r.id,
          type: 'impression' as const,
          country: r.country || 'Indonesia',
          city: r.city || 'Jakarta',
          device: r.device || 'Mobile',
          browser: r.browser || 'Chrome',
          ip_address: r.ip_address || '180.252.10.4',
          landing_page: r.landing_page || '/',
          created_at: r.created_at || r.timestamp || new Date().toISOString(),
          forwarding_status: isForwarding ? 'Sent to Apps Script' : 'Disabled',
        })),
        ...clkList.map((r) => ({
          id: r.id,
          type: 'click' as const,
          country: r.country || 'Indonesia',
          city: r.city || 'Jakarta',
          device: r.device || 'Mobile',
          browser: r.browser || 'Chrome',
          ip_address: r.ip_address || '180.252.10.4',
          gclid: r.gclid,
          utm_source: r.utm_source,
          keyword: r.keyword,
          landing_page: r.landing_page || '/',
          created_at: r.created_at || r.timestamp || new Date().toISOString(),
          forwarding_status: isForwarding ? 'Sent to Apps Script' : 'Disabled',
        })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setLiveFeed(combinedFeed.slice(0, 50));
    } catch (err) {
      console.error('Error loading dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [
    profile?.user_id,
    profile?.apps_script_url,
    profile?.forwarding_active,
    trackingKey,
    selectedWebsiteId,
    dateFilter,
    customStartDate,
    customEndDate,
  ]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Realtime Subscriptions for live traffic feed
  useEffect(() => {
    if (!trackingKey) return;

    const impChannel = supabase
      .channel(`rt-imp-${trackingKey}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'page_views' },
        (payload) => {
          const r = payload.new as Record<string, unknown>;
          const belongsToSelectedWebsite = selectedWebsiteId
            ? r.website_id === selectedWebsiteId
            : r.tracking_key === trackingKey;
          if (belongsToSelectedWebsite) {
            const item: LiveFeedItem = {
              id: String(r.id || ''),
              type: 'impression',
              country: String(r.country || 'Indonesia'),
              city: String(r.city || 'Jakarta'),
              device: String(r.device || 'Mobile'),
              browser: String(r.browser || 'Chrome'),
              ip_address: String(r.ip_address || '180.252.10.4'),
              landing_page: String(r.landing_page || '/'),
              created_at: String(r.created_at || r.timestamp || new Date().toISOString()),
              forwarding_status: profile?.apps_script_url && profile?.forwarding_active ? 'Sent to Apps Script' : 'Disabled',
            };
            setLiveFeed((prev) => [item, ...prev].slice(0, 50));
            setStats((prev) => {
              const newImp = prev.totalImpressions + 1;
              return {
                ...prev,
                totalImpressions: newImp,
                ctr: newImp > 0 ? (prev.totalClicks / newImp) * 100 : 0,
              };
            });

            // Update chart bar if not yesterday filter
            if (dateFilter !== 'yesterday') {
              const now = new Date();
              const isSingleDay =
                dateFilter === 'today' ||
                customStartDate === customEndDate;
              const currentSlot = `${String(Math.floor(now.getHours() / 3) * 3).padStart(2, '0')}:00`;
              const todayStr = now.toISOString().slice(0, 10);

              setTimeline((prev) =>
                prev.map((pt) => {
                  if ((isSingleDay && pt.date === currentSlot) || (!isSingleDay && pt.date === todayStr)) {
                    return { ...pt, impressions: pt.impressions + 1 };
                  }
                  return pt;
                })
              );
              chartAnimKey.current += 1;
              setChartReady(false);
              requestAnimationFrame(() => requestAnimationFrame(() => setChartReady(true)));
            }
          }
        }
      )
      .subscribe();

    const clkChannel = supabase
      .channel(`rt-clk-${trackingKey}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'clicks' },
        (payload) => {
          const r = payload.new as Record<string, unknown>;
          const belongsToSelectedWebsite = selectedWebsiteId
            ? r.website_id === selectedWebsiteId
            : r.tracking_key === trackingKey;
          if (belongsToSelectedWebsite) {
            const item: LiveFeedItem = {
              id: String(r.id || ''),
              type: 'click',
              country: String(r.country || 'Indonesia'),
              city: String(r.city || 'Jakarta'),
              device: String(r.device || 'Mobile'),
              browser: String(r.browser || 'Chrome'),
              ip_address: String(r.ip_address || '180.252.10.4'),
              gclid: r.gclid ? String(r.gclid) : undefined,
              utm_source: r.utm_source ? String(r.utm_source) : undefined,
              keyword: r.keyword ? String(r.keyword) : undefined,
              landing_page: String(r.landing_page || '/'),
              created_at: String(r.created_at || r.timestamp || new Date().toISOString()),
              forwarding_status: profile?.apps_script_url && profile?.forwarding_active ? 'Sent to Apps Script' : 'Disabled',
            };
            setLiveFeed((prev) => [item, ...prev].slice(0, 50));
            setStats((prev) => {
              const newClicks = prev.totalClicks + 1;
              return {
                ...prev,
                totalClicks: newClicks,
                ctr: prev.totalImpressions > 0 ? (newClicks / prev.totalImpressions) * 100 : 0,
              };
            });

            // Update chart bar if not yesterday filter
            if (dateFilter !== 'yesterday') {
              const now = new Date();
              const isSingleDay =
                dateFilter === 'today' ||
                customStartDate === customEndDate;
              const currentSlot = `${String(Math.floor(now.getHours() / 3) * 3).padStart(2, '0')}:00`;
              const todayStr = now.toISOString().slice(0, 10);

              setTimeline((prev) =>
                prev.map((pt) => {
                  if ((isSingleDay && pt.date === currentSlot) || (!isSingleDay && pt.date === todayStr)) {
                    return { ...pt, clicks: pt.clicks + 1 };
                  }
                  return pt;
                })
              );
              chartAnimKey.current += 1;
              setChartReady(false);
              requestAnimationFrame(() => requestAnimationFrame(() => setChartReady(true)));
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(impChannel);
      supabase.removeChannel(clkChannel);
    };
  }, [
    trackingKey,
    profile?.user_id,
    profile?.apps_script_url,
    profile?.forwarding_active,
    selectedWebsiteId,
    dateFilter,
    customStartDate,
    customEndDate,
  ]);

  // Live Simulation Trigger
  async function simulateEvent(eventType: 'page_view' | 'click') {
    if (!trackingKey || trackingKey === 'YOUR_TRACKING_KEY') {
      notify('Buat atau pilih website aktif terlebih dahulu agar tracking key valid.', 'error');
      return;
    }

    setSimulating(true);
    const domain = window.location.origin;

    const dummyLocations = [
      { city: 'Jakarta', country: 'Indonesia', ip: '180.252.10.88' },
      { city: 'Surabaya', country: 'Indonesia', ip: '114.122.34.12' },
      { city: 'Bandung', country: 'Indonesia', ip: '182.1.45.99' },
      { city: 'Medan', country: 'Indonesia', ip: '103.28.15.6' },
      { city: 'Singapore', country: 'Singapore', ip: '128.199.200.5' },
    ];
    const loc = dummyLocations[Math.floor(Math.random() * dummyLocations.length)];
    const devices = ['Mobile', 'Desktop', 'Tablet'];
    const browsers = ['Chrome', 'Safari', 'Firefox', 'Edge'];
    const device = devices[Math.floor(Math.random() * devices.length)];
    const browser = browsers[Math.floor(Math.random() * browsers.length)];

    const payload =
      eventType === 'page_view'
        ? {
            event: 'page_view',
            tracking_key: trackingKey,
            landing_page: `${domain}/landing-promo`,
            referrer: 'https://google.com',
            device,
            browser,
            city: loc.city,
            country: loc.country,
            ip_address: loc.ip,
          }
        : {
            event: 'click',
            tracking_key: trackingKey,
            landing_page: `${domain}/landing-promo`,
            gclid: 'CjwKCAiA_' + Math.random().toString(36).substring(2, 10),
            utm_source: 'google_ads',
            utm_medium: 'cpc',
            utm_campaign: 'campaign_september',
            keyword: 'tracking google ads gratis',
            device,
            browser,
            city: loc.city,
            country: loc.country,
            ip_address: loc.ip,
          };

    try {
      const endpoints = ['/api/public/track', `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track`];
      let sent = false;

      for (const ep of endpoints) {
        try {
          const res = await fetch(ep, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
          if (res.ok) {
            sent = true;
            break;
          }
        } catch {
          // try next endpoint
        }
      }

      if (sent) {
        notify(`Event ${eventType.toUpperCase()} berhasil dikirim secara real-time!`, 'success');
      } else {
        notify('Gagal mengirim event simulasi — periksa koneksi server', 'error');
      }
    } catch {
      notify('Koneksi simulasi gagal', 'error');
    } finally {
      setSimulating(false);
    }
  }

  const maxVal = Math.max(...timeline.map((t) => Math.max(t.impressions, t.clicks)), 1);
  const isEmptyState = !loading && stats.totalImpressions === 0 && stats.totalClicks === 0;
  const dateRangeBounds = getDateRangeBounds(dateFilter, customStartDate, customEndDate);

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Top Banner / Guidance Header */}
      <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/40 via-zinc-900/80 to-cyan-950/40 p-6 backdrop-blur-xl shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <h2 className="text-base font-bold text-white">VRN TRACK ADS — Real-time Google Ads Visitor Tracker</h2>
            </div>
            <p className="text-xs text-zinc-300 max-w-2xl leading-relaxed">
              Lacak <strong>IP Pengunjung, Geo-Lokasi (Kota/Negara), GCLID, UTM, &amp; Keyword</strong> yang tidak disediakan langsung oleh Google Ads console. Semua data diteruskan otomatis ke Google Spreadsheet Anda!
            </p>
          </div>

          <div className="flex flex-col items-end gap-2 shrink-0">
            <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-zinc-950/60 px-3 py-2 text-xs text-zinc-300">
              <span className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Website</span>
              <select
                value={selectedWebsiteId ?? ''}
                onChange={(e) => setSelectedWebsiteId(e.target.value || null)}
                className="rounded-lg border border-white/10 bg-zinc-900 px-2 py-1 text-xs text-white outline-none focus:border-emerald-500"
              >
                {websites.length === 0 ? (
                  <option value="">Belum ada website</option>
                ) : (
                  websites.map((site) => (
                    <option key={site.id} value={site.id}>{site.name}</option>
                  ))
                )}
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => simulateEvent('page_view')}
                disabled={simulating}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/20 px-3.5 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/30 disabled:opacity-50 shadow"
              >
                <Zap className="h-3.5 w-3.5 text-emerald-400" />
                Simulasi Page View
              </button>
              <button
                onClick={() => simulateEvent('click')}
                disabled={simulating}
                className="flex items-center gap-1.5 rounded-xl border border-cyan-500/40 bg-cyan-500/20 px-3.5 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/30 disabled:opacity-50 shadow"
              >
                <MousePointerClick className="h-3.5 w-3.5 text-cyan-400" />
                Simulasi Click CTA
              </button>
              <button
                onClick={loadData}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-zinc-300 hover:bg-white/10 transition"
                title="Refresh Dashboard Data"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
            <Calendar className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-white">Filter Periode</span>
              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                {dateFilter === 'today' && 'Hari Ini'}
                {dateFilter === 'yesterday' && 'Kemarin'}
                {dateFilter === '7days' && '7 Hari Terakhir'}
                {dateFilter === 'custom' && 'Rentang Kustom'}
              </span>
            </div>
            <p className="text-xs text-zinc-400 mt-0.5">
              {formatDisplayDateRange(dateRangeBounds.start, dateRangeBounds.end, dateFilter)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* UI Select Dropdown */}
          <div className="relative">
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as DateFilter)}
              className="appearance-none rounded-xl border border-white/15 bg-zinc-900/90 pl-3.5 pr-9 py-2 text-xs font-medium text-white shadow-inner hover:border-emerald-500/50 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition cursor-pointer"
            >
              <option value="today" className="bg-zinc-900 text-white">Hari Ini (Today)</option>
              <option value="yesterday" className="bg-zinc-900 text-white">Kemarin (Yesterday)</option>
              <option value="7days" className="bg-zinc-900 text-white">7 Hari Terakhir (Last 7 Days)</option>
              <option value="custom" className="bg-zinc-900 text-white">Rentang Kustom (Custom Range)...</option>
            </select>
            <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400">
              <ChevronDown className="h-3.5 w-3.5" />
            </div>
          </div>

          {/* Custom Date Pickers (revealed when 'custom' is selected) */}
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2 bg-zinc-950/60 px-2.5 py-1 rounded-xl border border-white/10">
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1 text-xs text-white focus:border-emerald-500 focus:outline-none [color-scheme:dark]"
              />
              <span className="text-xs text-zinc-400">s/d</span>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="rounded-lg border border-white/10 bg-zinc-900 px-2.5 py-1 text-xs text-white focus:border-emerald-500 focus:outline-none [color-scheme:dark]"
              />
            </div>
          )}

          {/* Refresh Button */}
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-zinc-300 hover:bg-white/10 hover:text-white transition disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Empty State Banner (Displayed when database has 0 records) */}
      {isEmptyState && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 backdrop-blur-xl space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div className="space-y-1 flex-1">
              <h3 className="text-sm font-bold text-amber-200">
                {dateFilter === 'today'
                  ? 'Belum Ada Traffic Hari Ini'
                  : dateFilter === 'yesterday'
                  ? 'Tidak Ada Traffic Pada Hari Kemarin'
                  : 'Belum Ada Data Pelacakan (SDK Belum Terdeteksi)'}
              </h3>
              <p className="text-xs text-amber-300/80 leading-relaxed">
                {dateFilter === 'today' || dateFilter === 'yesterday'
                  ? 'Belum ada kunjungan atau klik CTA yang tercatat pada rentang waktu ini. Silakan ganti rentang waktu ke "7 Hari Terakhir" atau coba uji dengan tombol simulasi di atas.'
                  : 'Landing Page Anda belum mengirimkan event kunjungan atau klik. Silakan salin & pasang tag script SDK VRN TRACK ADS di landing page Anda, atau uji aliran data dengan tombol simulasi di atas.'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 pl-14">
            {onNavigate && (
              <button
                onClick={() => onNavigate('settings')}
                className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-zinc-950 hover:bg-amber-400 transition shadow-md"
              >
                Buka Integration Settings &amp; Pasang SDK
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={() => simulateEvent('page_view')}
              className="flex items-center gap-1.5 rounded-xl border border-amber-500/40 bg-zinc-900/60 px-4 py-2 text-xs font-semibold text-amber-300 hover:bg-zinc-900 transition"
            >
              Kirim Event Simulasi Sekarang
            </button>
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Eye}
          label="Total Page Views"
          value={stats.totalImpressions.toLocaleString()}
          accent="emerald"
        />
        <StatCard
          icon={MousePointerClick}
          label="Total Clicks (Klik CTA)"
          value={stats.totalClicks.toLocaleString()}
          accent="cyan"
        />
        <StatCard
          icon={TrendingUp}
          label="CTR (Click-Through Rate)"
          value={`${stats.ctr.toFixed(2)}%`}
          accent="amber"
        />
        <StatCard
          icon={Plug}
          label="Google Sheets Status"
          value={stats.integrationStatus === 'Connected' ? 'Spreadsheet Connected' : 'Webhook Pending'}
          accent={stats.integrationStatus === 'Connected' ? 'emerald' : 'red'}
        />
      </div>

      {/* Traffic Chart */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">
              {dateFilter === 'today' && 'Grafik Performa Traffic (Hari Ini)'}
              {dateFilter === 'yesterday' && 'Grafik Performa Traffic (Kemarin)'}
              {dateFilter === '7days' && 'Grafik Performa Traffic (7 Hari Terakhir)'}
              {dateFilter === 'custom' && `Grafik Performa Traffic (${customStartDate} s/d ${customEndDate})`}
            </h3>
            <p className="text-xs text-zinc-400">
              {dateFilter === 'today' || dateFilter === 'yesterday'
                ? 'Volume kunjungan vs klik CTA per interval waktu'
                : 'Volume kunjungan vs klik CTA pengunjung'}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Page Views
            </span>
            <span className="flex items-center gap-1.5 text-zinc-400">
              <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" /> Clicks
            </span>
          </div>
        </div>

        <div
          className="flex h-56 items-end justify-between gap-2 sm:gap-4 border-b border-white/5 pb-2"
        >
          {timeline.map((point, i) => (
            <div key={point.date} className="group flex flex-1 flex-col items-center gap-2">
              <div className="flex h-full w-full items-end justify-center gap-1.5">
                {/* Page View Bar */}
                <div
                  className="relative w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-emerald-600/40 to-emerald-400 group-hover:from-emerald-500/60 group-hover:to-emerald-300"
                  style={{
                    height: chartReady
                      ? point.impressions > 0
                        ? `${(point.impressions / maxVal) * 100}%`
                        : '4px'
                      : '0px',
                    transition: `height 0.6s cubic-bezier(0.34,1.56,0.64,1) ${i * 60}ms`,
                  }}
                >
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-emerald-300 opacity-0 transition group-hover:opacity-100 z-10 pointer-events-none">
                    {point.impressions} imp
                  </span>
                </div>
                {/* Click Bar */}
                <div
                  className="relative w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-cyan-600/40 to-cyan-400 group-hover:from-cyan-500/60 group-hover:to-cyan-300"
                  style={{
                    height: chartReady
                      ? point.clicks > 0
                        ? `${(point.clicks / maxVal) * 100}%`
                        : '4px'
                      : '0px',
                    transition: `height 0.6s cubic-bezier(0.34,1.56,0.64,1) ${i * 60 + 30}ms`,
                  }}
                >
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-cyan-300 opacity-0 transition group-hover:opacity-100 z-10 pointer-events-none">
                    {point.clicks} clk
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-zinc-500">{formatTimelineLabel(point.date)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rich Data Table for Live Traffic Stream (Real-Time Database Feed) */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 px-6 py-4 gap-2">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Live Traffic Stream (Real-Time Database Feed)</h3>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              Supabase Realtime Subscribed
            </span>
          </div>
        </div>

        <div className="max-h-[500px] overflow-y-auto">
          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-zinc-500 flex flex-col items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-emerald-400" />
              Memuat data real-time dari Supabase...
            </div>
          ) : liveFeed.length === 0 ? (
            <div className="px-6 py-12 text-center space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 border border-white/10 text-zinc-500">
                <Globe className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-zinc-300">Belum ada data traffic yang terekam.</p>
              <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
                Pasang script pelacak di Landing Page Anda atau klik tombol simulasi di atas untuk melihat aliran data secara langsung!
              </p>
            </div>
          ) : (
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-zinc-950/90 backdrop-blur-xl border-b border-white/10 z-10">
                <tr className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
                  <th className="px-4 py-3">Waktu (HH:mm:ss)</th>
                  <th className="px-4 py-3">Event Type</th>
                  <th className="px-4 py-3">IP &amp; Geo Location (USP)</th>
                  <th className="px-4 py-3">Device &amp; Browser</th>
                  <th className="px-4 py-3">Parameter (GCLID / UTM / KW)</th>
                  <th className="px-4 py-3 text-right">Forwarding Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {liveFeed.map((item) => (
                  <tr key={item.id} className="transition hover:bg-white/[0.03]">
                    {/* Timestamp HH:mm:ss */}
                    <td className="px-4 py-3 font-mono text-xs text-zinc-300 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3 w-3 text-zinc-500" />
                        <span className="font-semibold text-emerald-300">{formatHHMMSS(item.created_at)}</span>
                      </div>
                      <div className="text-[10px] text-zinc-500 pl-4">{timeAgo(item.created_at)}</div>
                    </td>

                    {/* Event Type Badge */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wide ${
                          item.type === 'click'
                            ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                            : 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                        }`}
                      >
                        {item.type === 'click' ? (
                          <MousePointerClick className="h-3 w-3 text-cyan-400" />
                        ) : (
                          <Eye className="h-3 w-3 text-emerald-400" />
                        )}
                        {item.type.toUpperCase()}
                      </span>
                    </td>

                    {/* IP & Geo Location */}
                    <td className="px-4 py-3 text-xs text-zinc-200">
                      <div className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                        <Terminal className="h-3 w-3 text-emerald-400" />
                        {item.ip_address || '180.252.10.4'}
                      </div>
                      <div className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                        <Globe className="h-3 w-3 text-cyan-400" />
                        {item.city}, {item.country}
                      </div>
                    </td>

                    {/* Device & Browser */}
                    <td className="px-4 py-3 text-xs text-zinc-300">
                      <div className="flex items-center gap-1.5 font-medium">
                        <Smartphone className="h-3.5 w-3.5 text-zinc-400" />
                        {item.device}
                      </div>
                      <div className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
                        <Monitor className="h-3 w-3 text-zinc-500" />
                        {item.browser || 'Browser'}
                      </div>
                    </td>

                    {/* Captured Parameters */}
                    <td className="px-4 py-3 text-xs">
                      {item.type === 'click' ? (
                        <div className="space-y-1">
                          {item.gclid && (
                            <span className="inline-flex items-center gap-1 rounded bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                              <Tag className="h-3 w-3 text-cyan-400" />
                              GCLID: {item.gclid.slice(0, 16)}...
                            </span>
                          )}
                          {item.utm_source && (
                            <span className="inline-flex items-center gap-1 rounded bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[10px] font-mono text-indigo-300 ml-1">
                              UTM: {item.utm_source}
                            </span>
                          )}
                          {item.keyword && (
                            <div className="text-[11px] text-amber-300 flex items-center gap-1 font-medium">
                              <Search className="h-3 w-3 text-amber-400" />
                              &ldquo;{item.keyword}&rdquo;
                            </div>
                          )}
                          {!item.gclid && !item.utm_source && !item.keyword && (
                            <span className="text-zinc-600 font-mono text-xs">-</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-zinc-500 text-[11px] italic">Page View Visit</span>
                      )}
                    </td>

                    {/* Forwarding Status */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {profile?.apps_script_url && profile?.forwarding_active ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-300">
                          <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          Sent to Sheets
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-0.5 text-[10px] font-medium text-zinc-400">
                          <AlertCircle className="h-3 w-3 text-zinc-500" />
                          Log Only
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
  accent: 'emerald' | 'cyan' | 'amber' | 'red';
}) {
  const colors = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[0.05] shadow-lg">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${colors[accent]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-white tracking-tight">{value}</div>
    </div>
  );
}

function formatHHMMSS(iso: string): string {
  try {
    const d = new Date(iso);
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  } catch {
    return '--:--:--';
  }
}

function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const s = Math.floor(diff / 1000);
    if (s < 5) return 'Baru saja';
    if (s < 60) return `${s}d lalu`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m lalu`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}j lalu`;
    return `${Math.floor(h / 24)}h lalu`;
  } catch {
    return 'Baru saja';
  }
}
