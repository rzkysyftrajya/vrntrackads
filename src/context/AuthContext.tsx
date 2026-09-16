import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  quickDemoLogin: () => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(uid: string, currentUser?: User | null) {
    const fallbackProfile: Profile = {
      id: uid,
      user_id: uid,
      display_name: (currentUser || user)?.email?.split('@')[0] || 'VRN User',
      apps_script_url: null,
      tracking_key: uid,
      forwarding_active: true,
      created_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .or(`user_id.eq.${uid},id.eq.${uid}`)
        .maybeSingle();

      if (error) {
        console.warn('Could not fetch profiles row:', error.message);
        setProfile(fallbackProfile);
        return;
      }

      if (!data) {
        // Attempt to create profile row with fallback
        const { data: created } = await supabase
          .from('profiles')
          .insert({
            id: uid,
            user_id: uid,
            display_name: fallbackProfile.display_name,
            tracking_key: uid,
            forwarding_active: true,
          })
          .select('*')
          .maybeSingle();

        setProfile((created as Profile) || fallbackProfile);
      } else {
        setProfile(data as Profile);
      }
    } catch {
      setProfile(fallbackProfile);
    }
  }

  async function refreshProfile() {
    if (user) await loadProfile(user.id, user);
  }

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session);
        const currentUser = data.session?.user ?? null;
        setUser(currentUser);
        if (currentUser) {
          loadProfile(currentUser.id, currentUser).finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        setLoading(false);
      });

    // Safety timeout so UI never stays stuck on loading
    timeout = setTimeout(() => setLoading(false), 4000);

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      const currentUser = newSession?.user ?? null;
      setUser(currentUser);
      if (event === 'SIGNED_OUT') {
        setProfile(null);
      }
      if (currentUser) {
        loadProfile(currentUser.id, currentUser);
      }
    });

    return () => {
      clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        if (
          error.message.toLowerCase().includes('email not confirmed') ||
          error.message.toLowerCase().includes('invalid login credentials')
        ) {
          try {
            const res = await fetch('/api/auth/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password }),
            });
            if (res.ok) {
              const retry = await supabase.auth.signInWithPassword({ email, password });
              if (!retry.error) return { error: null };
            }
          } catch {
            // Ignore backend auto-confirm failure and return original error
          }
        }
        return { error: error.message };
      }

      return { error: null };
    } catch (err: any) {
      return { error: err?.message || 'Login failed' };
    }
  }

  async function signUp(email: string, password: string) {
    try {
      // 1. Try server-side auto-confirm registration
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });

        if (res.ok) {
          const loginRes = await supabase.auth.signInWithPassword({ email, password });
          if (!loginRes.error) {
            return { error: null };
          }
        }
      } catch {
        // Fallback to direct Supabase Auth
      }

      // 2. Direct Supabase Auth fallback
      const { data, error } = await supabase.auth.signUp({ email, password });

      if (error) {
        if (error.message.toLowerCase().includes('rate limit')) {
          return {
            error:
              'Email rate limit Supabase terlampaui. Silakan gunakan tombol "Demo / Quick Access" di bawah atau coba Login langsung.',
          };
        }
        return { error: error.message };
      }

      if (data.session) {
        return { error: null };
      }

      const directLogin = await supabase.auth.signInWithPassword({ email, password });
      if (!directLogin.error) {
        return { error: null };
      }

      return {
        error: null,
      };
    } catch (err: any) {
      return { error: err?.message || 'Registration failed' };
    }
  }

  async function quickDemoLogin() {
    const demoEmail = 'demo@vrntrackads.com';
    const demoPassword = 'demo-password-2026';
    return await signUp(demoEmail, demoPassword);
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signIn,
        signUp,
        quickDemoLogin,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
