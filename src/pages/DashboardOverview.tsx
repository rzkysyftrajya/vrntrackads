import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { mockTimeline, mockLiveFeed, mockStats } from '@/lib/mockData';
import type { TimelinePoint, LiveFeedItem } from '@/lib/types';
import { Eye, MousePointerClick, TrendingUp, Plug, Activity, Smartphone, Globe, Clock } from 'lucide-react';

export default function DashboardOverview() {
  const { profile } = useAuth();
  const [timeline, setTimeline] = useState<TimelinePoint[]>(mockTimeline);
  const [liveFeed, setLiveFeed] = useState<LiveFeedItem[]>(mockLiveFeed);
  const [stats, setStats] = useState(mockStats);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!profile?.user_id) return;
    const { data: impressions } = await supabase
      .from('impressions')
      .select('created_at')
      .eq('user_id', profile.user_id)
      .order('created_at', { ascending: true })
      .limit(1000);
    const { data: clicks } = await supabase
      .from('clicks')
      .select('created_at')
      .eq('user_id', profile.user_id)
      .order('created_at', { ascending: true })
      .limit(1000);

    const impCount = impressions?.length ?? 0;
    const clkCount = clicks?.length ?? 0;

    if (impCount > 0 || clkCount > 0) {
      setStats({
        totalImpressions: impCount,
        totalClicks: clkCount,
        ctr: impCount > 0 ? (clkCount / impCount) * 100 : 0,
        integrationStatus: profile.apps_script_url ? 'Connected' : 'Disconnected',
      });

      // Build 7-day timeline
      const days: Record<string, { impressions: number; clicks: number }> = {};
      const now = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        days[key] = { impressions: 0, clicks: 0 };
      }
      impressions?.forEach((r) => {
        const key = r.created_at.slice(0, 10);
        if (days[key]) days[key].impressions++;
      });
      clicks?.forEach((r) => {
        const key = r.created_at.slice(0, 10);
        if (days[key]) days[key].clicks++;
      });
      setTimeline(Object.entries(days).map(([date, v]) => ({ date, ...v })));
    }

    setLoading(false);
  }, [profile?.user_id, profile?.apps_script_url]);

  useEffect(() => { loadData(); }, [loadData]);

  // Realtime subscriptions
  useEffect(() => {
    if (!profile?.user_id) return;

    const impChannel = supabase
      .channel('impressions-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'impressions', filter: `user_id=eq.${profile.user_id}` }, (payload) => {
        const row = payload.new as Record<string, string>;
        const item: LiveFeedItem = {
          id: row.id,
          type: 'impression',
          country: row.country || 'Unknown',
          city: row.city || 'Unknown',
          device: row.device || 'Unknown',
          landing_page: row.landing_page || '',
          created_at: row.created_at,
        };
        setLiveFeed((prev) => [item, ...prev].slice(0, 50));
        setStats((prev) => ({ ...prev, totalImpressions: prev.totalImpressions + 1 }));
      })
      .subscribe();

    const clkChannel = supabase
      .channel('clicks-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clicks', filter: `user_id=eq.${profile.user_id}` }, (payload) => {
        const row = payload.new as Record<string, string>;
        const item: LiveFeedItem = {
          id: row.id,
          type: 'click',
          country: row.country || 'Unknown',
          city: row.city || 'Unknown',
          device: row.device || 'Unknown',
          landing_page: row.landing_page || '',
          created_at: row.created_at,
        };
        setLiveFeed((prev) => [item, ...prev].slice(0, 50));
        setStats((prev) => ({
          ...prev,
          totalClicks: prev.totalClicks + 1,
          ctr: prev.totalImpressions > 0 ? ((prev.totalClicks + 1) / prev.totalImpressions) * 100 : 0,
        }));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(impChannel);
      supabase.removeChannel(clkChannel);
    };
  }, [profile?.user_id]);

  const maxVal = Math.max(...timeline.map((t) => Math.max(t.impressions, t.clicks)), 1);

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Eye} label="Total Impressions" value={stats.totalImpressions.toLocaleString()} accent="emerald" />
        <StatCard icon={MousePointerClick} label="Total Clicks" value={stats.totalClicks.toLocaleString()} accent="cyan" />
        <StatCard icon={TrendingUp} label="CTR %" value={`${stats.ctr.toFixed(2)}%`} accent="amber" />
        <StatCard
          icon={Plug}
          label="Integration Status"
          value={stats.integrationStatus}
          accent={stats.integrationStatus === 'Connected' ? 'emerald' : 'red'}
        />
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-white">Impressions vs Clicks</h3>
            <p className="text-xs text-zinc-500">Last 7 days</p>
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5 text-zinc-400"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Impressions</span>
            <span className="flex items-center gap-1.5 text-zinc-400"><span className="h-2.5 w-2.5 rounded-full bg-cyan-400" /> Clicks</span>
          </div>
        </div>

        <div className="flex h-64 items-end justify-between gap-2 sm:gap-4">
          {timeline.map((point) => (
            <div key={point.date} className="group flex flex-1 flex-col items-center gap-2">
              <div className="flex h-full w-full items-end justify-center gap-1.5">
                <div
                  className="relative w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-emerald-600/40 to-emerald-400 transition-all duration-300 group-hover:from-emerald-500/60 group-hover:to-emerald-300"
                  style={{ height: `${(point.impressions / maxVal) * 100}%` }}
                >
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-emerald-300 opacity-0 transition group-hover:opacity-100">
                    {point.impressions}
                  </span>
                </div>
                <div
                  className="relative w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-cyan-600/40 to-cyan-400 transition-all duration-300 group-hover:from-cyan-500/60 group-hover:to-cyan-300"
                  style={{ height: `${(point.clicks / maxVal) * 100}%` }}
                >
                  <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-cyan-300 opacity-0 transition group-hover:opacity-100">
                    {point.clicks}
                  </span>
                </div>
              </div>
              <span className="text-[10px] text-zinc-500">{point.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Live feed */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Live Traffic Stream</h3>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
            Live
          </span>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="px-6 py-8 text-center text-sm text-zinc-500">Loading...</div>
          ) : liveFeed.length === 0 ? (
            <div className="px-6 py-8 text-center text-sm text-zinc-500">No traffic yet. Install the tracking SDK to start receiving data.</div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-zinc-950/80 backdrop-blur-xl">
                <tr className="text-left text-[10px] uppercase tracking-wider text-zinc-500">
                  <th className="px-6 py-2 font-medium">Type</th>
                  <th className="px-6 py-2 font-medium">Location</th>
                  <th className="hidden px-6 py-2 font-medium sm:table-cell">Device</th>
                  <th className="hidden px-6 py-2 font-medium md:table-cell">Landing Page</th>
                  <th className="px-6 py-2 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody>
                {liveFeed.map((item) => (
                  <tr key={item.id} className="border-t border-white/5 transition hover:bg-white/[0.02]">
                    <td className="px-6 py-3">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${item.type === 'click' ? 'bg-cyan-500/10 text-cyan-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
                        {item.type === 'click' ? <MousePointerClick className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        {item.type}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-xs text-zinc-300">
                      <Globe className="mr-1 inline h-3 w-3 text-zinc-500" />
                      {item.city}, {item.country}
                    </td>
                    <td className="hidden px-6 py-3 text-xs text-zinc-400 sm:table-cell">
                      <Smartphone className="mr-1 inline h-3 w-3 text-zinc-500" />
                      {item.device}
                    </td>
                    <td className="hidden px-6 py-3 text-xs text-zinc-400 md:table-cell max-w-[200px] truncate">{item.landing_page}</td>
                    <td className="px-6 py-3 text-right text-xs text-zinc-500">
                      <Clock className="mr-1 inline h-3 w-3" />
                      {timeAgo(item.created_at)}
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

function StatCard({ icon: Icon, label, value, accent }: { icon: typeof Eye; label: string; value: string; accent: 'emerald' | 'cyan' | 'amber' | 'red' }) {
  const colors = {
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
    cyan: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
    amber: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/20',
  };
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[0.05]">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-400">{label}</span>
        <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${colors[accent]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-2xl font-bold text-white">{value}</div>
    </div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
