import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { Key, Code2, Link2, ToggleLeft, ToggleRight, Loader2, Check, Copy, Send } from 'lucide-react';

export default function SettingsPage() {
  const { profile, refreshProfile } = useAuth();
  const { notify } = useToast();
  const [appsScriptUrl, setAppsScriptUrl] = useState('');
  const [forwardingActive, setForwardingActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);

  useEffect(() => {
    if (profile) {
      setAppsScriptUrl(profile.apps_script_url || '');
      setForwardingActive(profile.forwarding_active);
    }
  }, [profile]);

  if (!profile) return null;

  const trackingKey = profile.tracking_key;
  const domain = window.location.origin;
  const snippet = `<script src="${domain}/track.js" data-tracking-id="${trackingKey}"></script>`;

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ apps_script_url: appsScriptUrl || null, forwarding_active: forwardingActive })
      .eq('user_id', profile!.user_id);
    setSaving(false);
    if (error) {
      notify('Failed to save settings', 'error');
    } else {
      notify('Settings saved successfully', 'success');
      await refreshProfile();
    }
  }

  async function handleToggleForwarding() {
    const newVal = !forwardingActive;
    setForwardingActive(newVal);
    const { error } = await supabase
      .from('profiles')
      .update({ forwarding_active: newVal })
      .eq('user_id', profile!.user_id);
    if (error) {
      setForwardingActive(!newVal);
      notify('Failed to toggle forwarding', 'error');
    } else {
      notify(`Forwarding ${newVal ? 'enabled' : 'disabled'}`, 'success');
      await refreshProfile();
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://qtgbuacxiuntczeaqlqi.supabase.co';
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_mtB461pYvcwJAtH50KlZrw_S35zH6Pi';

      const payload = {
        event: 'impression',
        tracking_key: trackingKey,
        landing_page: `${domain}/test-connection`,
        referrer: 'vrn-track-ads-test',
      };

      const endpoints = [
        '/api/public/track',
        `${supabaseUrl}/functions/v1/track`,
      ];

      let success = false;
      let lastErrorMessage = '';

      for (const endpoint of endpoints) {
        try {
          const res = await fetch(endpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${anonKey}`,
            },
            body: JSON.stringify(payload),
          });

          if (res.ok) {
            success = true;
            break;
          } else {
            const data = await res.json().catch(() => ({}));
            lastErrorMessage = data.error || `HTTP ${res.status}`;
          }
        } catch (e: any) {
          lastErrorMessage = e?.message || 'Network error';
        }
      }

      if (success) {
        notify('Test event sent successfully! Check your live stream.', 'success');
      } else {
        notify(lastErrorMessage || 'Test failed — check your tracking key', 'error');
      }
    } catch {
      notify('Network error — could not reach tracking endpoint', 'error');
    }
    setTesting(false);
  }

  function copy(text: string, setFlag: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    setFlag(true);
    setTimeout(() => setFlag(false), 2000);
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Tracking Key */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-2">
          <Key className="h-4 w-4 text-emerald-400" />
          <h3 className="text-sm font-semibold text-white">Your Tracking Key</h3>
        </div>
        <p className="mb-4 text-xs text-zinc-400">This unique key identifies your account in all tracking events. Use it in the embed snippet below.</p>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/50 p-3">
          <code className="flex-1 truncate font-mono text-sm text-emerald-300">{trackingKey}</code>
          <button onClick={() => copy(trackingKey, setCopiedKey)} className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-white/10">
            {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </section>

      {/* Embed Snippet */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-2">
          <Code2 className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">Embed Snippet</h3>
        </div>
        <p className="mb-4 text-xs text-zinc-400">Add this script tag to your landing page's <code className="text-cyan-300">&lt;head&gt;</code> or before <code className="text-cyan-300">&lt;/body&gt;</code>.</p>
        <div className="relative">
          <pre className="overflow-x-auto rounded-lg border border-white/10 bg-zinc-950/80 p-4 text-xs text-zinc-300">
            <code>{snippet}</code>
          </pre>
          <button onClick={() => copy(snippet, setCopiedSnippet)} className="absolute right-3 top-3 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-white/10">
            {copiedSnippet ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        </div>
      </section>

      {/* Apps Script URL */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <div className="mb-4 flex items-center gap-2">
          <Link2 className="h-4 w-4 text-amber-400" />
          <h3 className="text-sm font-semibold text-white">Google Apps Script URL</h3>
        </div>
        <p className="mb-4 text-xs text-zinc-400">Events will be forwarded to this URL as JSON POST requests when forwarding is active.</p>
        <input
          type="url"
          value={appsScriptUrl}
          onChange={(e) => setAppsScriptUrl(e.target.value)}
          placeholder="https://script.google.com/macros/s/your-script-id/exec"
          className="w-full rounded-lg border border-white/10 bg-zinc-900/50 px-3 py-2.5 text-sm text-white placeholder-zinc-600 outline-none transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
        />

        {/* Forwarding toggle */}
        <div className="mt-4 flex items-center justify-between rounded-lg border border-white/10 bg-zinc-900/30 p-4">
          <div>
            <div className="text-sm font-medium text-white">Event Forwarding</div>
            <div className="text-xs text-zinc-500">Forward all tracking events to your Apps Script URL</div>
          </div>
          <button onClick={handleToggleForwarding} className="transition">
            {forwardingActive ? (
              <ToggleRight className="h-8 w-8 text-emerald-400" />
            ) : (
              <ToggleLeft className="h-8 w-8 text-zinc-600" />
            )}
          </button>
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save Settings
          </button>
          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-zinc-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Test Connection
          </button>
        </div>
      </section>
    </div>
  );
}
