import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import AuthPage from '@/pages/AuthPage';
import Layout, { type PageId } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import SettingsPage from '@/pages/SettingsPage';
import InstallationGuide from '@/pages/InstallationGuide';
import { Activity } from 'lucide-react';

function AppContent() {
  const { session, loading } = useAuth();
  const [page, setPage] = useState<PageId>('overview');

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#09090b]">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
            <Activity className="h-7 w-7 animate-pulse text-emerald-400" />
          </div>
          <p className="text-sm text-zinc-500">Loading VRN TRACK ADS...</p>
        </div>
      </div>
    );
  }

  if (!session) return <AuthPage />;

  return (
    <Layout currentPage={page} onNavigate={setPage}>
      {page === 'overview' && <DashboardOverview onNavigate={setPage} />}
      {page === 'settings' && <SettingsPage />}
      {page === 'guide' && <InstallationGuide />}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
