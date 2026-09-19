import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
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
  Download,
  Filter,
  UserCheck,
  Copy,
  Cpu,
} from 'lucide-react';

import {
  getDateRangeBounds,
  formatDisplayDateRange,
  formatTimelineLabel,
} from '@/lib/dateUtils';

interface DashboardStats {
  totalImpressions: number;
  uniqueVisitors: number;
  duplicateRefreshes: number;
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
    uniqueVisitors: 0,
    duplicateRefreshes: 0,
    totalClicks: 0,
    ctr: 0,
    integrationStatus: 'Disconnected',
  });
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [chartReady, setChartReady] = useState(false);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(null);
  const [hideRefreshAndBot, setHideRefreshAndBot] = useState(false);
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

  const activeWebsite = websites.find((site) => site.id === selectedWebsiteId) ?? websites[0] ?? null;
  const activeWebsiteId = activeWebsite?.id ?? null;
  const trackingKey = activeWebsite?.tracking_key || (!websites.length ? profile?.tracking_key || profile?.user_id : null);

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
          return nextWebsites[0]?.id || null;
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
      const websiteScopedQuery = activeWebsiteId
        ? supabase.from(pageViewsTable).select('*').eq('website_id', activeWebsiteId)
        : supabase.from(pageViewsTable).select('*').or(`user_id.eq.${profile?.user_id},tracking_key.eq.${trackingKey}`);

      const websiteScopedClickQuery = activeWebsiteId
        ? supabase.from('clicks').select('*').eq('website_id', activeWebsiteId)
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

      // Fallback: in case Supabase schema uses 'timestamp' column name instead of 'created_at'
      if (impErr && (impErr.message?.includes('page_views') || impErr.message?.includes('impressions') || impErr.message?.includes('created_at') || (impErr as { code?: string }).code === '42703' || (impErr as { code?: string }).code === '42P01')) {
        const fallbackImp = activeWebsiteId
          ? await supabase.from('impressions').select('*').eq('website_id', activeWebsiteId).gte('timestamp', bounds.startIso).lte('timestamp', bounds.endIso).order('timestamp', { ascending: false }).limit(500)
          : await supabase.from('impressions').select('*').or(`user_id.eq.${profile?.user_id},tracking_key.eq.${trackingKey}`).gte('timestamp', bounds.startIso).lte('timestamp', bounds.endIso).order('timestamp', { ascending: false }).limit(500);
        impressions = fallbackImp.data;
        impErr = fallbackImp.error;
      }

      if (clkErr && (clkErr.message?.includes('created_at') || (clkErr as { code?: string }).code === '42703')) {
        const fallbackClk = activeWebsiteId
          ? await supabase.from('clicks').select('*').eq('website_id', activeWebsiteId).gte('timestamp', bounds.startIso).lte('timestamp', bounds.endIso).order('timestamp', { ascending: false }).limit(500)
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

      // Unique Visitors (is_duplicate === false && !is_bot)
      const uniqueVisitors = impList.filter((r) => !r.is_duplicate && !r.is_bot).length;
      const duplicateRefreshes = impList.filter((r) => r.is_duplicate || r.status === 'DUPLICATE').length;

      // Calculate Stats
      setStats({
        totalImpressions: impCount,
        uniqueVisitors,
        duplicateRefreshes,
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
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setChartReady(true));
      });

      const isForwarding = Boolean(profile?.apps_script_url && profile?.forwarding_active);

      // Combine feed items
      const combinedFeed: LiveFeedItem[] = [
        ...impList.map((r) => ({
          id: r.id,
          type: 'impression' as const,
          country: r.country || 'Unknown',
          city: r.city || 'Unknown',
          device: r.device || 'Unknown',
          browser: r.browser || 'Unknown',
          ip_address: r.ip_address || 'Unknown',
          landing_page: r.landing_page || r.page_url || '/',
          fingerprint: r.fingerprint || null,
          screen_resolution: r.screen_resolution || null,
          cpu_cores: r.cpu_cores || null,
          device_memory: r.device_memory || null,
          gpu_renderer: r.gpu_renderer || null,
          timezone: r.timezone || null,
          language: r.language || null,
          is_duplicate: Boolean(r.is_duplicate || r.status === 'DUPLICATE'),
          is_bot: Boolean(r.is_bot || r.status === 'BOT_FILTERED'),
          status: r.status || (r.is_bot ? 'BOT_FILTERED' : r.is_duplicate ? 'DUPLICATE' : 'OK'),
          created_at: r.created_at || r.timestamp || new Date().toISOString(),
          forwarding_status: isForwarding ? 'Sent to Apps Script' : 'Disabled',
        })),
        ...clkList.map((r) => ({
          id: r.id,
          type: 'click' as const,
          country: r.country || 'Unknown',
          city: r.city || 'Unknown',
          device: r.device || 'Unknown',
          browser: r.browser || 'Unknown',
          ip_address: r.ip_address || 'Unknown',
          gclid: r.gclid,
          utm_source: r.utm_source,
          keyword: r.keyword,
          landing_page: r.landing_page || '/',
          fingerprint: r.fingerprint || null,
          screen_resolution: r.screen_resolution || null,
          cpu_cores: r.cpu_cores || null,
          device_memory: r.device_memory || null,
          gpu_renderer: r.gpu_renderer || null,
          timezone: r.timezone || null,
          language: r.language || null,
          is_duplicate: Boolean(r.is_duplicate),
          is_bot: Boolean(r.is_bot),
          status: r.status || 'OK',
          created_at: r.created_at || r.timestamp || new Date().toISOString(),
          forwarding_status: isForwarding ? 'Sent to Apps Script' : 'Disabled',
        })),
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setLiveFeed(combinedFeed);
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
    activeWebsiteId,
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
          const belongsToSelectedWebsite = activeWebsiteId
            ? r.website_id === activeWebsiteId
            : r.tracking_key === trackingKey;
          if (belongsToSelectedWebsite) {
            const isDup = Boolean(r.is_duplicate || r.status === 'DUPLICATE');
            const isBot = Boolean(r.is_bot || r.status === 'BOT_FILTERED');
            const item: LiveFeedItem = {
              id: String(r.id || ''),
              type: 'impression',
              country: String(r.country || 'Unknown'),
              city: String(r.city || 'Unknown'),
              device: String(r.device || 'Unknown'),
              browser: String(r.browser || 'Unknown'),
              ip_address: String(r.ip_address || 'Unknown'),
              landing_page: String(r.landing_page || r.page_url || '/'),
              fingerprint: r.fingerprint ? String(r.fingerprint) : null,
              screen_resolution: r.screen_resolution ? String(r.screen_resolution) : null,
              cpu_cores: typeof r.cpu_cores === 'number' ? r.cpu_cores : null,
              device_memory: typeof r.device_memory === 'number' ? r.device_memory : null,
              gpu_renderer: r.gpu_renderer ? String(r.gpu_renderer) : null,
              timezone: r.timezone ? String(r.timezone) : null,
              language: r.language ? String(r.language) : null,
              is_duplicate: isDup,
              is_bot: isBot,
              status: String(r.status || (isBot ? 'BOT_FILTERED' : isDup ? 'DUPLICATE' : 'OK')),
              created_at: String(r.created_at || r.timestamp || new Date().toISOString()),
              forwarding_status: profile?.apps_script_url && profile?.forwarding_active ? 'Sent to Apps Script' : 'Disabled',
            };
            setLiveFeed((prev) => [item, ...prev]);
            setStats((prev) => {
              const newImp = prev.totalImpressions + 1;
              const newUniq = !isDup && !isBot ? prev.uniqueVisitors + 1 : prev.uniqueVisitors;
              const newDup = isDup ? prev.duplicateRefreshes + 1 : prev.duplicateRefreshes;
              return {
                ...prev,
                totalImpressions: newImp,
                uniqueVisitors: newUniq,
                duplicateRefreshes: newDup,
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
          const belongsToSelectedWebsite = activeWebsiteId
            ? r.website_id === activeWebsiteId
            : r.tracking_key === trackingKey;
          if (belongsToSelectedWebsite) {
            const item: LiveFeedItem = {
              id: String(r.id || ''),
              type: 'click',
              country: String(r.country || 'Unknown'),
              city: String(r.city || 'Unknown'),
              device: String(r.device || 'Unknown'),
              browser: String(r.browser || 'Unknown'),
              ip_address: String(r.ip_address || 'Unknown'),
              gclid: r.gclid ? String(r.gclid) : undefined,
              utm_source: r.utm_source ? String(r.utm_source) : undefined,
              keyword: r.keyword ? String(r.keyword) : undefined,
              landing_page: String(r.landing_page || '/'),
              created_at: String(r.created_at || r.timestamp || new Date().toISOString()),
              forwarding_status: profile?.apps_script_url && profile?.forwarding_active ? 'Sent to Apps Script' : 'Disabled',
            };
            setLiveFeed((prev) => [item, ...prev]);
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
    activeWebsiteId,
    dateFilter,
    customStartDate,
    customEndDate,
  ]);

  // Filtered Live Feed based on Toggle
  const displayedFeed = useMemo(() => {
    if (!hideRefreshAndBot) return liveFeed;
    return liveFeed.filter((item) => !item.is_duplicate && !item.is_bot && item.status !== 'DUPLICATE' && item.status !== 'BOT_FILTERED');
  }, [liveFeed, hideRefreshAndBot]);

  // Export to CSV Function
  const exportToCSV = () => {
    if (displayedFeed.length === 0) {
      notify('Tidak ada data log untuk di-export.', 'error');
      return;
    }

    const headers = [
      'Tanggal/Waktu',
      'Event Type',
      'IP Address',
      'Fingerprint',
      'Status',
      'Is Duplicate',
      'Is Bot',
      'Country',
      'City',
      'Device',
      'Browser',
      'GPU Renderer',
      'CPU Cores',
      'Device Memory (GB)',
      'Screen Resolution',
      'Timezone',
      'Language',
      'Landing Page',
      'GCLID',
      'UTM Source',
      'Keyword',
    ];

    const csvRows = displayedFeed.map((item) => {
      return [
        `"${item.created_at}"`,
        `"${item.type}"`,
        `"${item.ip_address || ''}"`,
        `"${item.fingerprint || ''}"`,
        `"${item.status || (item.is_bot ? 'BOT' : item.is_duplicate ? 'DUPLICATE' : 'OK')}"`,
        `"${item.is_duplicate ? 'TRUE' : 'FALSE'}"`,
        `"${item.is_bot ? 'TRUE' : 'FALSE'}"`,
        `"${item.country || ''}"`,
        `"${item.city || ''}"`,
        `"${item.device || ''}"`,
        `"${item.browser || ''}"`,
        `"${(item.gpu_renderer || '').replace(/"/g, '""')}"`,
        `"${item.cpu_cores ?? ''}"`,
        `"${item.device_memory ?? ''}"`,
        `"${item.screen_resolution || ''}"`,
        `"${item.timezone || ''}"`,
        `"${item.language || ''}"`,
        `"${(item.landing_page || '').replace(/"/g, '""')}"`,
        `"${item.gclid || ''}"`,
        `"${item.utm_source || ''}"`,
        `"${(item.keyword || '').replace(/"/g, '""')}"`,
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...csvRows].join('\r\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    const filename = `vrntrack_logs_${activeWebsite?.name || 'export'}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notify(`Berhasil mengexport ${displayedFeed.length} baris log ke ${filename}`, 'success');
  };

  // Live Simulation Trigger
  async function simulateEvent(eventType: 'page_view' | 'click') {
    if (!trackingKey || trackingKey === 'YOUR_TRACKING_KEY') {
      notify('Buat atau pilih website aktif terlebih dahulu agar tracking key valid.', 'error');
      return;
    }

    try {
      setSimulating(true);

      const fakeFingerprint = 'sim_fp_' + Math.random().toString(36).substring(2, 10);
      const payload: Record<string, unknown> = {
        event: eventType,
        tracking_key: trackingKey,
        session_id: 'sim_sess_' + Math.random().toString(36).substring(2, 9),
        fingerprint: fakeFingerprint,
        landing_page: window.location.origin + '/landing-demo',
        page_url: window.location.origin + '/landing-demo',
        referrer: 'https://google.com/search?q=vrn+tracking+ads',
        country: 'Indonesia',
        city: 'Jakarta',
        device: 'Desktop',
        browser: 'Chrome 128.0',
        screen_resolution: '1920x1080',
        cpu_cores: 8,
        device_memory: 16,
        gpu_renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11)',
        timezone: 'Asia/Jakarta',
        language: 'id-ID',
      };

      if (eventType === 'click') {
        payload.gclid = 'Cj0KCQjwmOm3BhDhARIsAPg_V1a9Xyz' + Math.random().toString(36).substring(2, 8);
        payload.utm_source = 'google_ads_search';
        payload.utm_medium = 'cpc';
        payload.utm_campaign = 'promo_skincare_q4';
        payload.keyword = 'jasa iklan google ads terpercaya';
      }

      const endpoints = [
        `${window.location.origin}/api/public/track`,
        `https://qtgbuacxiuntczeaqlqi.supabase.co/functions/v1/track`,
      ];

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
              Lacak <strong>Browser Fingerprint, Hardware Spec, IP, Kota, GCLID, UTM, &amp; Deteksi Refresh/Bot</strong> secara otomatis dan akurat.
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

      {/* Empty State Banner */}
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

      {/* Stat Cards - Top Bar Metrics */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          icon={Eye}
          label="Total Impressions"
          value={stats.totalImpressions.toLocaleString()}
          accent="emerald"
          subtitle="Semua Page Views"
        />
        <StatCard
          icon={UserCheck}
          label="Unique Visitors"
          value={stats.uniqueVisitors.toLocaleString()}
          accent="purple"
          subtitle="Non-Duplicate & Non-Bot"
        />
        <StatCard
          icon={Copy}
          label="Duplicates / Refresh"
          value={stats.duplicateRefreshes.toLocaleString()}
          accent="amber"
          subtitle="Refresh < 1 Jam"
        />
        <StatCard
          icon={MousePointerClick}
          label="Total Clicks (CTA)"
          value={stats.totalClicks.toLocaleString()}
          accent="cyan"
          subtitle="Semua Klik Target"
        />
        <StatCard
          icon={TrendingUp}
          label="CTR (Click-Through)"
          value={`${stats.ctr.toFixed(2)}%`}
          accent="emerald"
          subtitle="Clicks / Impressions"
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
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/10 px-6 py-4 gap-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Live Traffic Stream &amp; Device Logs</h3>
            <span className="text-xs text-zinc-500 font-mono">({displayedFeed.length} data)</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Toggle: Sembunyikan Refresh & Bot */}
            <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-white/10 bg-zinc-900/80 px-3 py-1.5 text-xs text-zinc-300 hover:border-emerald-500/40 transition">
              <input
                type="checkbox"
                checked={hideRefreshAndBot}
                onChange={(e) => setHideRefreshAndBot(e.target.checked)}
                className="rounded border-zinc-700 bg-zinc-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-950 h-3.5 w-3.5"
              />
              <Filter className="h-3.5 w-3.5 text-emerald-400" />
              <span>Sembunyikan Refresh &amp; Bot</span>
            </label>

            {/* Export to CSV / Excel Button */}
            <button
              onClick={exportToCSV}
              className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20 transition shadow"
              title="Download Data Log ke File CSV"
            >
              <Download className="h-3.5 w-3.5 text-emerald-400" />
              Export to Excel / CSV
            </button>

            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400 border border-emerald-500/20">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              Realtime Active
            </span>
          </div>
        </div>

        <div className="max-h-[550px] overflow-x-auto overflow-y-auto">
          {loading ? (
            <div className="px-6 py-12 text-center text-sm text-zinc-500 flex flex-col items-center gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-emerald-400" />
              Memuat data real-time dari Supabase...
            </div>
          ) : displayedFeed.length === 0 ? (
            <div className="px-6 py-12 text-center space-y-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900 border border-white/10 text-zinc-500">
                <Globe className="h-6 w-6" />
              </div>
              <p className="text-sm font-medium text-zinc-300">
                {hideRefreshAndBot ? 'Tidak ada data pengunjung unik pada filter saat ini.' : 'Belum ada data traffic yang terekam.'}
              </p>
              <p className="text-xs text-zinc-500 max-w-md mx-auto leading-relaxed">
                Pasang script pelacak di Landing Page Anda atau klik tombol simulasi di atas untuk melihat aliran data secara langsung!
              </p>
            </div>
          ) : (
            <table className="w-full text-left min-w-[950px]">
              <thead className="sticky top-0 bg-zinc-950/95 backdrop-blur-xl border-b border-white/10 z-10">
                <tr className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold">
                  <th className="px-4 py-3">Waktu</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">IP &amp; Geo Location</th>
                  <th className="px-4 py-3">Device Specs &amp; GPU</th>
                  <th className="px-4 py-3">Fingerprint Hash</th>
                  <th className="px-4 py-3">Parameter (GCLID / UTM)</th>
                  <th className="px-4 py-3 text-right">Forwarding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {displayedFeed.map((item) => {
                  const isBot = item.is_bot || item.status === 'BOT_FILTERED';
                  const isDup = item.is_duplicate || item.status === 'DUPLICATE';

                  return (
                    <tr key={item.id} className="transition hover:bg-white/[0.03]">
                      {/* Timestamp HH:mm:ss */}
                      <td className="px-4 py-3 font-mono text-xs text-zinc-300 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3 text-zinc-500" />
                          <span className="font-semibold text-emerald-300">{formatHHMMSS(item.created_at)}</span>
                        </div>
                        <div className="text-[10px] text-zinc-500 pl-4">{timeAgo(item.created_at)}</div>
                      </td>

                      {/* Status Badge (OK / DUPLICATE / BOT) */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isBot ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 border border-red-500/30 px-2.5 py-0.5 text-[10px] font-bold text-red-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                            🔴 BOT
                          </span>
                        ) : isDup ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-bold text-amber-400" title="Refresh dalam kurun waktu 1 jam">
                            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                            🟡 DUPLICATE
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-bold text-emerald-400">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            🟢 OK
                          </span>
                        )}
                      </td>

                      {/* Event Type Badge */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide ${
                            item.type === 'click'
                              ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/30'
                              : 'bg-zinc-800 text-zinc-300 border border-zinc-700'
                          }`}
                        >
                          {item.type === 'click' ? (
                            <MousePointerClick className="h-3 w-3 text-cyan-400" />
                          ) : (
                            <Eye className="h-3 w-3 text-zinc-400" />
                          )}
                          {item.type.toUpperCase()}
                        </span>
                      </td>

                      {/* IP & Geo Location */}
                      <td className="px-4 py-3 text-xs text-zinc-200">
                        <div className="font-mono text-xs font-bold text-white flex items-center gap-1.5">
                          <Terminal className="h-3 w-3 text-emerald-400" />
                          {item.ip_address || 'Unknown'}
                        </div>
                        <div className="text-[11px] text-zinc-400 flex items-center gap-1 mt-0.5">
                          <Globe className="h-3 w-3 text-cyan-400" />
                          {item.city}, {item.country}
                        </div>
                      </td>

                      {/* Device Specs & Hardware Details */}
                      <td className="px-4 py-3 text-xs text-zinc-300 max-w-xs">
                        <div className="flex items-center gap-1.5 font-medium text-white">
                          <Smartphone className="h-3.5 w-3.5 text-zinc-400" />
                          <span>{item.device} ({item.browser || 'Browser'})</span>
                        </div>
                        {/* Hardware Spec Badges */}
                        <div className="flex flex-wrap items-center gap-1 mt-1 text-[10px] text-zinc-400">
                          {item.screen_resolution && (
                            <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 border border-white/5 font-mono">
                              {item.screen_resolution}
                            </span>
                          )}
                          {item.cpu_cores && (
                            <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 border border-white/5 font-mono text-cyan-300">
                              {item.cpu_cores} Cores
                            </span>
                          )}
                          {item.device_memory && (
                            <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 border border-white/5 font-mono text-purple-300">
                              {item.device_memory}GB RAM
                            </span>
                          )}
                        </div>
                        {item.gpu_renderer && (
                          <div className="text-[10px] text-zinc-400 truncate mt-0.5 flex items-center gap-1" title={item.gpu_renderer}>
                            <Cpu className="h-2.5 w-2.5 text-emerald-400 shrink-0" />
                            <span className="truncate">{item.gpu_renderer}</span>
                          </div>
                        )}
                      </td>

                      {/* Fingerprint Hash */}
                      <td className="px-4 py-3 text-xs font-mono">
                        {item.fingerprint ? (
                          <span
                            className="inline-flex items-center gap-1 rounded bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 text-[10px] font-mono text-purple-300"
                            title={`Full Fingerprint: ${item.fingerprint}`}
                          >
                            <UserCheck className="h-2.5 w-2.5 text-purple-400" />
                            {item.fingerprint.length > 12
                              ? `${item.fingerprint.slice(0, 6)}...${item.fingerprint.slice(-4)}`
                              : item.fingerprint}
                          </span>
                        ) : (
                          <span className="text-zinc-600 text-[10px] italic">-</span>
                        )}
                      </td>

                      {/* Captured Parameters (GCLID / UTM / KW) */}
                      <td className="px-4 py-3 text-xs">
                        {item.type === 'click' ? (
                          <div className="space-y-1">
                            {item.gclid && (
                              <span className="inline-flex items-center gap-1 rounded bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 text-[10px] font-mono text-cyan-300">
                                <Tag className="h-3 w-3 text-cyan-400" />
                                GCLID: {item.gclid.slice(0, 12)}...
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
                          <div className="text-[11px] text-zinc-400 truncate max-w-[150px]" title={item.landing_page}>
                            {item.landing_page}
                          </div>
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
                  );
                })}
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
  subtitle,
  accent,
}: {
  icon: typeof Eye;
  label: string;
  value: string;
  subtitle?: string;
  accent: 'emerald' | 'cyan' | 'amber' | 'red' | 'purple';
}) {
  const colors = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
    purple: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
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
      {subtitle && <p className="text-[10px] text-zinc-500 mt-1 font-medium">{subtitle}</p>}
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
