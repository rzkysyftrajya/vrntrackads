import { useState, type ReactNode } from 'react';
import { useAuth } from '@/context/AuthContext';
import { LayoutDashboard, Settings, BookOpen, LogOut, Menu } from 'lucide-react';

export type PageId = 'overview' | 'settings' | 'guide';

interface LayoutProps {
  currentPage: PageId;
  onNavigate: (page: PageId) => void;
  children: ReactNode;
}

const navItems: { id: PageId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'settings', label: 'Integration Settings', icon: Settings },
  { id: 'guide', label: 'Installation Guide', icon: BookOpen },
];

export default function Layout({ currentPage, onNavigate, children }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100">
      {/* Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 h-screen w-64 border-r border-white/10 bg-zinc-950/80 backdrop-blur-xl transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex h-16 items-center gap-3 border-b border-white/10 px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 p-1 shadow-sm overflow-hidden">
            <img src="/logoVRN.png" alt="VRN Track Ads Logo" className="h-full w-full object-contain" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-bold tracking-wide text-white">VRN TRACK ADS</div>
            <div className="text-[10px] text-emerald-400 font-medium">Ultra Anti-Bot Platform</div>
          </div>
        </div>

        <nav className="px-3 py-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { onNavigate(item.id); setMobileOpen(false); }}
                className={`mb-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${active ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200 border border-transparent'}`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-white/10 p-3">
          <div className="mb-2 flex items-center gap-3 rounded-lg px-3 py-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-bold text-emerald-300">
              {(profile?.display_name || profile?.user_id || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-zinc-200">{profile?.display_name || 'User'}</div>
              <div className="truncate text-[10px] text-zinc-500">Account</div>
            </div>
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-red-500/10 hover:text-red-300"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Main */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-white/10 bg-zinc-950/60 px-6 backdrop-blur-xl">
          <div className="flex items-center gap-3">
            <button onClick={() => setMobileOpen(true)} className="lg:hidden text-zinc-400 hover:text-white">
              <Menu className="h-5 w-5" />
            </button>
            <h2 className="text-sm font-semibold text-white">
              {navItems.find((n) => n.id === currentPage)?.label}
            </h2>
          </div>
          <div className="flex items-center gap-2.5">
            <img src="/logoVRN.png" alt="VRN" className="h-5 w-5 object-contain" />
            <span className="hidden sm:inline text-xs text-zinc-400 font-medium">VRN TRACK ADS</span>
            <div className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
          </div>
        </header>

        <main className="p-6 lg:p-8">{children}</main>

        {/* Footer */}
        <footer className="border-t border-white/10 px-6 py-4 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-2 text-xs text-zinc-500 sm:flex-row">
            <span>VRN TRACK ADS &copy; 2026 — Ad Tracking & Analytics</span>
            <span>Powered by Supabase</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
