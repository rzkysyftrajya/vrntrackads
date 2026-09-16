import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Copy, Check, FileCode, Globe, Code2 as ReactIcon, Search, Table, ShieldCheck, Zap } from 'lucide-react';

type TabId = 'html' | 'nextjs' | 'react' | 'spreadsheet' | 'wordpress' | 'googleads';

const tabs: { id: TabId; label: string; icon: typeof FileCode }[] = [
  { id: 'html', label: 'HTML / PHP Native', icon: FileCode },
  { id: 'nextjs', label: 'Next.js (App / Pages Router)', icon: ReactIcon },
  { id: 'react', label: 'React SPA', icon: ReactIcon },
  { id: 'spreadsheet', label: 'Google Spreadsheet', icon: Table },
  { id: 'wordpress', label: 'WordPress', icon: Globe },
  { id: 'googleads', label: 'Google Ads UTM', icon: Search },
];

export default function InstallationGuide() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('html');
  const [copied, setCopied] = useState(false);

  const trackingKey = profile?.tracking_key || 'YOUR_TRACKING_KEY';
  const domain = window.location.origin;
  const scriptTag = `<script src="${domain}/track.js" data-tracking-id="${trackingKey}" async defer></script>`;

  const googleAppsScriptCode = `/**
 * VRN TRACK ADS — Google Sheets Webhook Script v2.0
 * Fitur: Auto Sheet Creation, Click & Impression Separation, Bot Filtered Sync
 * 
 * PANDUAN PEMASANGAN:
 * 1. Buka Google Sheets baru di spreadsheet.google.com
 * 2. Klik menu 'Extensions' (Ekstensi) > 'Apps Script'
 * 3. Hapus kode bawaan, lalu paste kode di bawah ini
 * 4. Klik 'Deploy' (Terapkan) > 'New deployment' (Penerapan baru)
 * 5. Pilih tipe: 'Web app' (Aplikasi web)
 * 6. Set 'Execute as': 'Me' (Email Anda)
 * 7. Set 'Who has access': 'Anyone' (Siapa saja) -> PENTING!
 * 8. Klik 'Deploy', izinkan akses (Authorize), lalu salin Web App URL
 * 9. Tempel Web App URL tersebut ke VRN TRACK ADS > Integration Settings!
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
        targetSheet.appendRow([
          'Timestamp', 'Tracking Key', 'Event', 'GCLID', 'UTM Source', 
          'UTM Medium', 'UTM Campaign', 'Keyword', 'Target CTA', 'Device', 'Landing Page', 'Country', 'City', 'IP Address'
        ]);
        targetSheet.getRange(1, 1, 1, 14).setFontWeight('bold').setBackground('#e2e8f0');
      } else {
        targetSheet.appendRow([
          'Timestamp', 'Tracking Key', 'Event', 'Device', 'Browser', 
          'Landing Page', 'Referrer', 'Country', 'City', 'IP Address'
        ]);
        targetSheet.getRange(1, 1, 1, 10).setFontWeight('bold').setBackground('#e2e8f0');
      }
    }
    
    var now = new Date();
    if (eventType === 'click') {
      targetSheet.appendRow([
        now,
        data.tracking_key || '',
        eventType,
        data.gclid || '',
        data.utm_source || '',
        data.utm_medium || '',
        data.utm_campaign || '',
        data.keyword || '',
        data.click_target || 'button/link',
        data.device || '',
        data.landing_page || '',
        data.country || '',
        data.city || '',
        data.ip_address || ''
      ]);
    } else {
      targetSheet.appendRow([
        now,
        data.tracking_key || '',
        eventType,
        data.device || '',
        data.browser || '',
        data.landing_page || '',
        data.referrer || '',
        data.country || '',
        data.city || '',
        data.ip_address || ''
      ]);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

  const nextJsSnippet = `// =======================================================
// OPSI 1: Next.js 13+ / 14+ / 15+ (App Router)
// File: app/layout.tsx
// =======================================================
import Script from 'next/script';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <head>
        <Script
          src="${domain}/track.js"
          data-tracking-id="${trackingKey}"
          strategy="afterInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}

// =======================================================
// OPSI 2: Next.js (Pages Router)
// File: pages/_app.tsx atau pages/_document.tsx
// =======================================================
import Script from 'next/script';
import type { AppProps } from 'next/app';

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <>
      <Script
        src="${domain}/track.js"
        data-tracking-id="${trackingKey}"
        strategy="afterInteractive"
      />
      <Component {...pageProps} />
    </>
  );
}`;

  const reactSpaSnippet = `// =======================================================
// React SPA (Vite / CRA)
// Opsi 1: Tambahkan langsung di index.html (Paling Disarankan)
// =======================================================
<!-- Di dalam file index.html sebelum tag </head> atau </body> -->
${scriptTag}

// =======================================================
// Opsi 2: Manual trigger di komponen CTA / WhatsApp Button
// =======================================================
function WhatsAppCTAButton() {
  const handleWhatsAppClick = () => {
    // SDK berjalan otomatis tanpa memanggil ini pun sudah terekam,
    // namun Anda juga bisa mengirim custom data secara manual:
    if (window.VRNTrack) {
      window.VRNTrack.trackClick({
        click_target: 'whatsapp_custom',
        button_name: 'Tombol Konsultasi Utama'
      });
    }
  };

  return (
    <a
      href="https://wa.me/6281234567890?text=Halo%20saya%20tertarik"
      onClick={handleWhatsAppClick}
      className="btn-whatsapp"
    >
      Hubungi via WhatsApp
    </a>
  );
}`;

  const snippets: Record<TabId, { title: string; code: string; note?: string }> = {
    html: {
      title: 'Pemasangan pada Landing Page HTML / PHP Native',
      code: `<!-- Letakkan script ini di dalam tag <head> atau sebelum tag </body> -->
${scriptTag}

<!-- CONTOH TOMBOL CTA / WHATSAPP: -->
<!-- SDK otomatis mendeteksi link wa.me, tel:, atau elemen dengan atribut data-vrn-click -->
<a href="https://wa.me/6281234567890" class="btn-wa">
  Chat WhatsApp (Otomatis Terlacak)
</a>`,
      note: 'Script berjalan 100% asynchronous dan non-blocking (async defer). Saat pengunjung mengklik tombol WhatsApp atau CTA, navigasi langsung terbuka instan tanpa delay atau layout shift (CLS).',
    },
    nextjs: {
      title: 'Pemasangan pada Next.js (App Router & Pages Router)',
      code: nextJsSnippet,
      note: 'Menggunakan strategy="afterInteractive" menjamin performa Google Lighthouse dan Core Web Vitals (LCP, FID, CLS) tetap 100.',
    },
    react: {
      title: 'Pemasangan pada React Single Page Application (Vite / CRA)',
      code: reactSpaSnippet,
      note: 'VRNTrack mengekspos window.VRNTrack secara global sehingga dapat dipanggil dari hooks atau event handler mana pun di dalam aplikasi React.',
    },
    spreadsheet: {
      title: 'Integrasi Otomatis Google Spreadsheet (Apps Script Webhook)',
      code: googleAppsScriptCode,
      note: 'Setelah Deploy di Google Apps Script, copy Web App URL lalu paste di menu Integration Settings. Bot fraud dan duplikasi gclid disaring secara otomatis sebelum masuk ke Spreadsheet.',
    },
    wordpress: {
      title: 'Pemasangan pada WordPress (Header Footer / functions.php)',
      code: `// Opsi 1: Pasang di functions.php tema aktif Anda
add_action('wp_head', function() {
  echo '<script src="${domain}/track.js" data-tracking-id="${trackingKey}" async defer></script>\\n';
});

// Opsi 2: Gunakan plugin "WPCode" atau "Header and Footer Scripts"
// Lalu paste snippet berikut ke bagian Header:
${scriptTag}`,
      note: 'Kompatibel dengan semua builder WordPress (Elementor, Divi, Gutenberg, Bricks).',
    },
    googleads: {
      title: 'Google Ads Final URL Suffix & Parameter Tracking',
      code: `# Di akun Google Ads Anda:
# Masuk ke: Settings > Account settings > Tracking > Final URL suffix
# Tempelkan parameter berikut:

{ignore}&utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&keyword={keyword}&device={device}&gclid={gclid}`,
      note: 'SDK otomatis menangkap gclid, utm_source, utm_medium, utm_campaign, keyword, dan device untuk pelaporan konversi & click fraud.',
    },
  };

  const current = snippets[activeTab];

  function copyCode() {
    navigator.clipboard.writeText(current.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header Banner */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <Zap className="h-4 w-4 text-emerald-400" />
          </div>
          <h3 className="text-sm font-semibold text-white">Panduan Integrasi & Pemasangan SDK</h3>
        </div>
        <p className="text-xs text-zinc-400 leading-relaxed mb-4">
          Pilih platform Anda di bawah ini dan salin snippet pelacak ke Landing Page Anda. SDK secara otomatis menangkap parameter iklan Google Ads (<code className="text-emerald-400">gclid</code>, <code className="text-emerald-400">utm_*</code>), mendeteksi traffic bot, dan mengirim data langsung ke dashboard serta Google Spreadsheet Anda tanpa mengganggu kecepatan halaman.
        </p>

        {/* Feature Highlights */}
        <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-white/5 text-[11px] text-zinc-400">
          <span className="flex items-center gap-1.5 text-emerald-300">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            Advanced Bot & Click Fraud Filter
          </span>
          <span className="text-zinc-600">•</span>
          <span className="flex items-center gap-1.5 text-cyan-300">
            <Zap className="h-3.5 w-3.5 text-cyan-400" />
            Zero UX Interference (Non-Blocking & Keepalive)
          </span>
          <span className="text-zinc-600">•</span>
          <span className="flex items-center gap-1.5 text-zinc-300">
            <Check className="h-3.5 w-3.5 text-emerald-400" />
            Auto-Detect WhatsApp & CTA
          </span>
        </div>

        {/* Tab buttons */}
        <div className="mt-6 mb-6 flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id);
                  setCopied(false);
                }}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  active
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-white/10 bg-zinc-900/30 text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Code block */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-xs font-medium text-zinc-300">{current.title}</h4>
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-white/10"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Tersalin!' : 'Salin Kode'}
            </button>
          </div>
          <pre className="max-h-[380px] overflow-x-auto overflow-y-auto rounded-lg border border-white/10 bg-zinc-950/80 p-4 text-xs leading-relaxed text-zinc-300 font-mono">
            <code>{current.code}</code>
          </pre>
          {current.note && (
            <p className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-xs text-cyan-200/90 leading-relaxed">
              <strong>Info Performa & Keamanan:</strong> {current.note}
            </p>
          )}
        </div>
      </div>

      {/* Quick reference */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <InfoCard
          title="Proteksi Bot & Fraud"
          items={[
            'Deteksi Webdriver & Headless Browser',
            'Screen Dimension Anomaly Filter',
            'Deduplikasi GCLID 24 Jam',
            'Spam Request Rate-Limiting',
          ]}
        />
        <InfoCard
          title="Zero UX Interference"
          items={[
            'Non-blocking async & defer',
            'fetch keepalive & sendBeacon',
            'Klik WhatsApp instan tanpa lag',
            'Silent error handling 100%',
          ]}
        />
        <InfoCard
          title="Data Real-Time Akurat"
          items={[
            'Auto Track Impression & Clicks',
            'Sinkronisasi Google Spreadsheet',
            'Live Traffic Feed Dashboard',
            'Filter Otomatis Sebelum Sync',
          ]}
        />
      </div>
    </div>
  );
}

function InfoCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
      <h4 className="mb-3 text-xs font-semibold text-white">{title}</h4>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2 text-xs text-zinc-400">
            <Check className="h-3 w-3 text-emerald-400 shrink-0" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
