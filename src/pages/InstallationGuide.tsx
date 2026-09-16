import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Copy, Check, FileCode, Globe, ShoppingCart, Code2 as ReactIcon, Search } from 'lucide-react';

type TabId = 'html' | 'wordpress' | 'react' | 'shopify' | 'googleads';

const tabs: { id: TabId; label: string; icon: typeof FileCode }[] = [
  { id: 'html', label: 'HTML', icon: FileCode },
  { id: 'wordpress', label: 'WordPress', icon: Globe },
  { id: 'react', label: 'React / Next.js', icon: ReactIcon },
  { id: 'shopify', label: 'Shopify', icon: ShoppingCart },
  { id: 'googleads', label: 'Google Ads', icon: Search },
];

export default function InstallationGuide() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('html');
  const [copied, setCopied] = useState(false);

  const trackingKey = profile?.tracking_key || 'YOUR_TRACKING_KEY';
  const domain = window.location.origin;
  const snippet = `<script src="${domain}/track.js" data-tracking-id="${trackingKey}"></script>`;

  const snippets: Record<TabId, { title: string; code: string; note?: string }> = {
    html: {
      title: 'Add to your HTML page',
      code: `<!-- Add this to your <head> or before </body> -->\n${snippet}`,
    },
    wordpress: {
      title: 'Add to WordPress (functions.php or a header plugin)',
      code: `// Add to your theme's functions.php or a code snippet plugin\nadd_action('wp_head', function() {\n  $tracking_key = '${trackingKey}';\n  $domain = '${domain}';\n  echo "<script src=\\"$domain/track.js\\" data-tracking-id=\\"$tracking_key\\"></script>\\n";\n});`,
    },
    react: {
      title: 'Add to React / Next.js (_app.tsx or layout.tsx)',
      code: `// In your root layout or _app.tsx, add the script tag\nimport Script from 'next/script';\n\nexport default function RootLayout({ children }) {\n  return (\n    <html>\n      <head>\n        <Script\n          src="${domain}/track.js"\n          data-tracking-id="${trackingKey}"\n          strategy="afterInteractive"\n        />\n      </head>\n      <body>{children}</body>\n    </html>\n  );\n}`,
    },
    shopify: {
      title: 'Add to Shopify (theme.liquid)',
      code: `<!-- In theme.liquid, add before </head> -->\n${snippet}\n\n<!-- Or via Shopify Admin: -->\n<!-- Online Store > Themes > Edit Code > theme.liquid -->`,
    },
    googleads: {
      title: 'Google Ads Final URL Suffix',
      code: `# In your Google Ads account:\n# Settings > Account settings > Tracking > Final URL suffix\n#\n# Add your UTM parameters so the SDK can capture them:\n\n{ignore}&utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&keyword={keyword}&gclid={gclid}`,
      note: 'The {ignore} prefix tells Google Ads not to validate the suffix. The SDK automatically reads gclid, utm_source, utm_medium, utm_campaign, and keyword from the URL.',
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
        <h3 className="mb-2 text-sm font-semibold text-white">Installation Guide</h3>
        <p className="mb-6 text-xs text-zinc-400">Choose your platform below and copy the tracking snippet into your site. The SDK auto-detects URL parameters (gclid, utm_source, utm_medium, utm_campaign, keyword), device, referrer, and fires impression and click events automatically.</p>

        {/* Tab buttons */}
        <div className="mb-6 flex flex-wrap gap-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setCopied(false); }}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${active ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-white/10 bg-zinc-900/30 text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
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
            <button onClick={copyCode} className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-zinc-300 transition hover:bg-white/10">
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <pre className="overflow-x-auto rounded-lg border border-white/10 bg-zinc-950/80 p-4 text-xs leading-relaxed text-zinc-300">
            <code>{current.code}</code>
          </pre>
          {current.note && (
            <p className="mt-3 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-xs text-cyan-200/80">
              {current.note}
            </p>
          )}
        </div>
      </div>

      {/* Quick reference */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <InfoCard title="Auto-Detected" items={['gclid', 'utm_source', 'utm_medium', 'utm_campaign', 'keyword']} />
        <InfoCard title="Captured" items={['Device', 'Browser', 'Country', 'City', 'IP Address', 'Referrer']} />
        <InfoCard title="Events Fired" items={['Impression (page load)', 'Click (CTA / link tap)']} />
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
            <Check className="h-3 w-3 text-emerald-400" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
