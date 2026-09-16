import { useState, type FormEvent } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Activity, Mail, Lock, Loader2 } from 'lucide-react';

export default function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const fn = mode === 'signin' ? signIn : signUp;
    const { error } = await fn(email, password);
    setLoading(false);
    if (error) setError(error);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#09090b] px-4">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[400px] w-[600px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 h-[300px] w-[400px] rounded-full bg-cyan-500/10 blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl">
            <Activity className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">VRN TRACK ADS</h1>
          <p className="mt-1 text-sm text-zinc-400">Ad tracking & analytics platform</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 backdrop-blur-xl">
          <div className="mb-6 flex rounded-lg border border-white/10 bg-zinc-900/50 p-1">
            <button
              onClick={() => setMode('signin')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${mode === 'signin' ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('signup')}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition ${mode === 'signup' ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-zinc-900/50 py-2.5 pl-10 pr-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-zinc-400">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg border border-white/10 bg-zinc-900/50 py-2.5 pl-10 pr-3 text-sm text-white placeholder-zinc-500 outline-none transition focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/30"
                  placeholder="Min 6 characters"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:opacity-50"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-zinc-600">
          By continuing you agree to our Terms & Privacy Policy
        </p>
      </div>
    </div>
  );
}
