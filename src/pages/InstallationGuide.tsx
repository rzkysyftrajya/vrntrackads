import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Copy, Check, FileCode, Globe, ShoppingCart, Code2 as ReactIcon, Search, Table } from 'lucide-react';

type TabId = 'html' | 'wordpress' | 'react' | 'shopify' | 'googleads' | 'spreadsheet';

const tabs: { id: TabId; label: string; icon: typeof FileCode }[] = [
  { id: 'html', label: 'HTML Landing Page', icon: FileCode },
  { id: 'spreadsheet', label: 'Google Spreadsheet', icon: Table },
  { id: 'wordpress', label: 'WordPress', icon: Globe },
  { id: 'react', label: 'React / Next.js', icon: ReactIcon },
  { id: 'shopify', label: 'Shopify', icon: ShoppingCart },
  { id: 'googleads', label: 'Google Ads UTM', icon: Search },
];

export default function InstallationGuide() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('html');
  const [copied, setCopied] = useState(false);

  const trackingKey = profile?.tracking_key || 'YOUR_TRACKING_KEY';
  const domain = window.location.origin;
  const snippet = `<script src="${domain}/track.js" data-tracking-id="${trackingKey}"></script>`;

  const googleAppsScriptCode = `/**
 * VRN TRACK ADS - Google Sheets Webhook Script
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
          'UTM Medium', 'UTM Campaign', 'Keyword', 'Device', 'Landing Page', 'Country', 'City', 'IP Address'
        ]);
        targetSheet.getRange(1, 1, 1, 13).setFontWeight('bold').setBackground('#e2e8f0');
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

  const snippets: Record<TabId, { title: string; code: string; note?: string }> = {
    html: {
      title: 'Pasang pada Landing Page HTML / PHP',
      code: `<!-- Tambahkan script ini di dalam tag <head> atau sebelum </body> pada Landing Page Anda -->\n${snippet}`,
      note: 'SDK akan otomatis merekam Impression saat halaman dimuat dan merekam Click saat pengunjung menekan tombol CTA / link.',
    },
    spreadsheet: {
      title: 'Integrasi Otomatis Google Spreadsheet (Apps Script)',
      code: googleAppsScriptCode,
      note: 'Setelah Deploy di Google Apps Script, copy Web App URL lalu paste di menu Integration Settings > Google Apps Script URL. Setiap ada pengunjung / klik, data langsung masuk ke Google Sheet Anda secara realtime!',
    },
    wordpress: {
      title: 'Pasang pada WordPress (Header Footer Code Manager / functions.php)',
      code: `// Opsi 1: Pasang di functions.php tema WordPress Anda\nadd_action('wp_head', function() {\n  echo '<script src="${domain}/track.js" data-tracking-id="${trackingKey}"></script>\\n';\n});\n\n// Opsi 2: Gunakan plugin "Header and Footer Scripts" lalu paste script di bawah:\n// ${snippet}`,
    },
    react: {
      title: 'Pasang pada Next.js / React (Root Layout)',
      code: `// Di root layout.tsx atau _app.tsx:\nimport Script from 'next/script';\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return (\n    <html>\n      <head>\n        <Script\n          src="${domain}/track.js"\n          data-tracking-id="${trackingKey}"\n          strategy="afterInteractive"\n        />\n      </head>\n      <body>{children}</body>\n    </html>\n  );\n}`,
    },
    shopify: {
      title: 'Pasang pada Shopify (theme.liquid)',
      code: `<!-- Buka Shopify Admin > Online Store > Themes > Edit Code > theme.liquid -->\n<!-- Tambahkan script ini sebelum tag </head> -->\n${snippet}`,
    },
    googleads: {
      title: 'Google Ads Final URL Suffix & UTM Tracking',
      code: `# Di akun Google Ads Anda:\n# Settings > Account settings > Tracking > Final URL suffix\n#\n# Tambahkan parameter ini agar data Google Ads terekam lengkap:\n\n{ignore}&utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&keyword={keyword}&gclid={gclid}`,
      note: 'SDK VRN TRACK ADS otomatis membaca parameter gclid, utm_source, utm_medium, utm_campaign, dan keyword dari URL iklan.',
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
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur-xl">
        <h3 className="mb-2 text-sm font-semibold text-white">Panduan Integrasi & Pemasangan SDK</h3>
        <p className="mb-6 text-xs text-zinc-400">
          Pilih platform Anda di bawah ini dan salin snippet pelacak ke Landing Page Anda. SDK secara otomatis menangkap parameter iklan Google Ads (gclid, utm), jenis perangkat, negara/kota, referrer, serta mengirim data langsung ke dashboard dan Google Spreadsheet Anda.
        </p>

        {/* Tab buttons */}
        <div className="mb-6 flex flex-wrap gap-2">
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
              <strong>Info:</strong> {current.note}
            </p>
          )}
        </div>
      </div>

      {/* Quick reference */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <InfoCard
          title="Auto-Detected URL"
          items={['gclid (Google Ads Click ID)', 'utm_source & utm_medium', 'utm_campaign', 'keyword']}
        />
        <InfoCard
          title="Captured Device & Geo"
          items={['Device (Mobile/Desktop/Tablet)', 'Browser & IP Address', 'Negara & Kota', 'Referrer URL']}
        />
        <InfoCard
          title="Auto-Fired Events"
          items={['Impression (Saat page load)', 'Click (Saat klik CTA/Tombol)', 'Real-Time Sync ke Spreadsheet']}
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
