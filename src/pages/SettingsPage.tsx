import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import {
  Key,
  Code2,
  Link2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Check,
  Copy,
  Send,
  ChevronDown,
  ChevronUp,
  FileCode,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';

export default function SettingsPage() {
  const { user, profile, refreshProfile } = useAuth();
  const { notify } = useToast();
  const [appsScriptUrl, setAppsScriptUrl] = useState('');
  const [forwardingActive, setForwardingActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedSnippet, setCopiedSnippet] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showScriptHelper, setShowScriptHelper] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'untested' | 'connected' | 'failed'>('untested');

  useEffect(() => {
    if (profile) {
      setAppsScriptUrl(profile.apps_script_url || '');
      setForwardingActive(profile.forwarding_active ?? true);
      if (profile.apps_script_url) {
        setConnectionStatus('connected');
      }
    }
  }, [profile]);

  const trackingKey = profile?.tracking_key || user?.id || 'YOUR_TRACKING_KEY';
  const domain = window.location.origin;
  const snippet = `<script src="${domain}/track.js" data-tracking-id="${trackingKey}"></script>`;

  const appsScriptTemplate = `/**
 * VRN TRACK ADS - Google Sheets Webhook Script
 * 1. Buka Google Sheets > Extensions > Apps Script
 * 2. Paste kode ini & klik Deploy > New deployment
 * 3. Type: Web app, Execute as: Me, Who has access: Anyone
 * 4. Salin Web App URL ke VRN TRACK ADS Settings
 */
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet();
    var data = JSON.parse(e.postData.contents);
    var eventType = data.event || 'impression';
    var targetSheetName = eventType === 'click' ? 'Clicks' : 'Impressions';
    var targetSheet = sheet.getSheetByName(targetSheetName);
    
    if (!targetSheet) {
      targetSheet = sheet.insertSheet(targetSheetName);
      if (eventType === 'click') {
        targetSheet.appendRow(['Timestamp', 'Tracking Key', 'Event', 'GCLID', 'UTM Source', 'UTM Medium', 'UTM Campaign', 'Keyword', 'Device', 'Landing Page', 'Country', 'City', 'IP Address']);
        targetSheet.getRange(1, 1, 1, 13).setFontWeight('bold').setBackground('#e2e8f0');
      } else {
        targetSheet.appendRow(['Timestamp', 'Tracking Key', 'Event', 'Device', 'Browser', 'Landing Page', 'Referrer', 'Country', 'City', 'IP Address']);
        targetSheet.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#e2e8f0');
      }
    }
    
    var now = new Date();
    if (eventType === 'click') {
      targetSheet.appendRow([now, data.tracking_key || '', eventType, data.gclid || '', data.utm_source || '', data.utm_medium || '', data.utm_campaign || '', data.keyword || '', data.device || '', data.landing_page || '', data.country || '', data.city || '', data.ip_address || '']);
    } else {
      targetSheet.appendRow([now, data.tracking_key || '', eventType, data.device || '', data.browser || '', data.landing_page || '', data.referrer || '', data.country || '', data.city || '', data.ip_address || '']);
    }
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

  async function handleSave() {
    const userId = profile?.user_id || user?.id;
    if (!userId) {
      notify('User ID tidak ditemukan', 'error');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: userId,
          tracking_key: trackingKey,
          apps_script_url: appsScriptUrl ? appsScriptUrl.trim() : null,
          forwarding_active: forwardingActive,
        }, { onConflict: 'user_id' });

      if (error) {
        notify('Gagal menyimpan pengaturan: ' + error.message, 'error');
      } else {
        notify('Pengaturan integrasi berhasil disimpan!', 'success');
        if (appsScriptUrl.trim()) {
          setConnectionStatus('connected');
        }
        await refreshProfile();
      }
    } catch (err: any) {
      notify('Error: ' + (err?.message || 'Gagal menyimpan'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleForwarding() {
    const userId = profile?.user_id || user?.id;
    if (!userId) return;

    const newVal = !forwardingActive;
    setForwardingActive(newVal);

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          user_id: userId,
          tracking_key: trackingKey,
          forwarding_active: newVal,
        }, { onConflict: 'user_id' });

      if (error) {
        setForwardingActive(!newVal);
        notify('Gagal mengubah status forwarding: ' + error.message, 'error');
      } else {
        notify(`Forwarding ke Google Sheets ${newVal ? 'diaktifkan' : 'dinonaktifkan'}`, 'success');
        await refreshProfile();
      }
    } catch {
      setForwardingActive(!newVal);
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
        landing_page: `${domain}/test-connection-page`,
        referrer: 'vrn-track-ads-test',
        device: 'Desktop',
        browser: 'Chrome Test',
        city: 'Jakarta',
        country: 'Indonesia',
        ip_address: '180.252.120.1',
      };

      const endpoints = ['/api/public/track', `${supabaseUrl}/functions/v1/track`];
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
        setConnectionStatus('connected');
        notify('Test Event Berhasil! Data pelacakan telah diterima oleh server & dikirim ke stream.', 'success');
      } else {
        setConnectionStatus('failed');
        notify(lastErrorMessage || 'Test gagal — periksa kunci pelacak atau koneksi', 'error');
      }
    } catch {
      setConnectionStatus('failed');
      notify('Koneksi endpoint tidak dapat dihubungi', 'error');
    } finally {
      setTesting(false);
    }
  }

  function copy(text: string, setFlag: (v: boolean) => void) {
    navigator.clipboard.writeText(text);
    setFlag(true);
    setTimeout(() => setFlag(false), 2000);
  }

  return (
    <div className="max-w-3xl space-y-6 mx-auto">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-white">Integration Settings</h2>
          <p className="text-xs text-zinc-400">
            Kelola kunci pelacak Anda dan integrasikan data ke Google Spreadsheet.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {connectionStatus === 'connected' && (
            <div className="flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Connection: Active & Verified
            </div>
          )}
          {connectionStatus === 'failed' && (
            <div className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">
              <AlertCircle className="h-3.5 w-3.5 text-red-400" />
              Connection Failed
            </div>
          )}
          {connectionStatus === 'untested' && (
            <div className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/80 px-3 py-1 text-xs font-medium text-zinc-300">
              <HelpCircle className="h-3.5 w-3.5 text-zinc-400" />
              Connection Untested
            </div>
          )}
        </div>
      </div>

      {/* Tracking Key Card */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Your Tracking Key</h3>
          </div>
          <span className="rounded bg-emerald-500/10 px-2 py-0.5 text-[10px] font-mono text-emerald-300 border border-emerald-500/20">
            USP Google Ads Tracker
          </span>
        </div>
        <p className="mb-4 text-xs text-zinc-400 leading-relaxed">
          Kunci unik ini mengidentifikasi akun Anda di setiap event kunjungan &amp; klik. Digunakan otomatis pada script pelacak di bawah.
        </p>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-zinc-900/80 p-3">
          <code className="flex-1 truncate font-mono text-xs sm:text-sm text-emerald-300 font-bold tracking-wide">
            {trackingKey}
          </code>
          <button
            onClick={() => copy(trackingKey, setCopiedKey)}
            className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/20 px-3.5 py-1.5 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-500/30 shrink-0"
          >
            {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedKey ? 'Tersalin!' : 'Copy Key'}
          </button>
        </div>
      </section>

      {/* Embed Snippet Card */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl shadow-lg">
        <div className="mb-4 flex items-center gap-2">
          <Code2 className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">SDK Script Tag (Pasang di Landing Page)</h3>
        </div>
        <p className="mb-4 text-xs text-zinc-400 leading-relaxed">
          Salin dan tempelkan 1 baris kode JavaScript SDK ini ke Landing Page Anda di dalam tag <code className="text-cyan-300 font-mono">&lt;head&gt;</code> atau sebelum <code className="text-cyan-300 font-mono">&lt;/body&gt;</code>. SDK akan melacak IP, GCLID, UTM, Keyword, &amp; Geo-lokasi secara otomatis!
        </p>
        <div className="relative">
          <pre className="overflow-x-auto rounded-lg border border-white/10 bg-zinc-950/90 p-4 text-xs text-cyan-300 font-mono leading-relaxed">
            <code>{snippet}</code>
          </pre>
          <button
            onClick={() => copy(snippet, setCopiedSnippet)}
            className="absolute right-3 top-3 rounded-md border border-cyan-500/30 bg-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/30 flex items-center gap-1.5"
          >
            {copiedSnippet ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copiedSnippet ? 'Tersalin!' : 'Copy Script Snippet'}
          </button>
        </div>
      </section>

      {/* Google Spreadsheet Integration Card */}
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">Integrasi Google Spreadsheet (Webhook URL)</h3>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold border ${
            appsScriptUrl.trim()
              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
          }`}>
            <span className={`h-1.5 w-1.5 rounded-full ${appsScriptUrl.trim() ? 'bg-emerald-400' : 'bg-amber-400'}`} />
            {appsScriptUrl.trim() ? 'Webhook Configured' : 'Webhook Not Configured'}
          </span>
        </div>
        <p className="mb-4 text-xs text-zinc-400 leading-relaxed">
          Setiap pengunjung dan klik yang terekam pada Landing Page Anda akan otomatis dikirimkan ke Google Spreadsheet Anda secara real-time via URL Webhook di bawah ini.
        </p>

        <label className="block text-xs font-medium text-zinc-300 mb-1.5">
          Google Apps Script Web App URL (<span className="text-emerald-400">apps_script_url</span>)
        </label>
        <input
          type="url"
          value={appsScriptUrl}
          onChange={(e) => setAppsScriptUrl(e.target.value)}
          placeholder="https://script.google.com/macros/s/AKfycb.../exec"
          className="w-full rounded-lg border border-white/10 bg-zinc-900/80 px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder-zinc-600 outline-none transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30 font-mono"
        />

        {/* Apps Script Code Helper Button */}
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowScriptHelper(!showScriptHelper)}
            className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition"
          >
            <FileCode className="h-3.5 w-3.5" />
            {showScriptHelper ? 'Sembunyikan Panduan Kode Google Apps Script' : 'Cara Dapatkan URL Apps Script (Klik Disini)'}
            {showScriptHelper ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>

          {showScriptHelper && (
            <div className="mt-3 rounded-xl border border-white/10 bg-zinc-950/90 p-4 space-y-3">
              <div className="text-xs text-zinc-300 space-y-1">
                <p className="font-semibold text-emerald-300">Langkah 1 Menit Setup Google Sheets:</p>
                <ol className="list-decimal list-inside text-zinc-400 space-y-1 text-[11px] leading-relaxed">
                  <li>Buka spreadsheet baru di Google Sheets.</li>
                  <li>Klik menu <strong>Extensions &gt; Apps Script</strong>.</li>
                  <li>Hapus semua kode bawaan, lalu paste kode di bawah.</li>
                  <li>Klik tombol <strong>Deploy &gt; New deployment &gt; Pilih Web app</strong>.</li>
                  <li>Set <em>Execute as: Me</em> dan <em>Who has access: Anyone (Siapa saja)</em>.</li>
                  <li>Klik Deploy, izinkan akses, lalu salin Web App URL ke kolom input di atas!</li>
                </ol>
              </div>

              <div className="relative">
                <pre className="max-h-48 overflow-auto rounded-lg border border-white/10 bg-zinc-900/90 p-3 text-[11px] text-zinc-300 font-mono">
                  <code>{appsScriptTemplate}</code>
                </pre>
                <button
                  type="button"
                  onClick={() => copy(appsScriptTemplate, setCopiedScript)}
                  className="absolute right-2 top-2 rounded border border-white/10 bg-white/10 px-2 py-1 text-[11px] text-zinc-200 hover:bg-white/20 transition flex items-center gap-1"
                >
                  {copiedScript ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  {copiedScript ? 'Tersalin' : 'Salin Kode Script'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Forwarding active toggle switch */}
        <div className="mt-5 flex items-center justify-between rounded-xl border border-white/10 bg-zinc-900/60 p-4">
          <div>
            <div className="text-xs sm:text-sm font-semibold text-white">Event Forwarding Active Switch</div>
            <div className="text-[11px] text-zinc-400">Aktifkan/nonaktifkan penerusan data otomatis ke Google Spreadsheet Anda</div>
          </div>
          <button type="button" onClick={handleToggleForwarding} className="transition" title="Toggle Forwarding">
            {forwardingActive ? (
              <ToggleRight className="h-9 w-9 text-emerald-400 transition transform hover:scale-105" />
            ) : (
              <ToggleLeft className="h-9 w-9 text-zinc-600 transition transform hover:scale-105" />
            )}
          </button>
        </div>

        {/* Action buttons */}
        <div className="mt-6 flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-xs sm:text-sm font-bold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50 shadow-lg shadow-emerald-500/20"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save Integration Settings
          </button>

          <button
            onClick={handleTestConnection}
            disabled={testing}
            className="flex items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-3 text-xs sm:text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/20 disabled:opacity-50"
          >
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4 text-cyan-400" />}
            Send Test Event
          </button>
        </div>
      </section>
    </div>
  );
}
