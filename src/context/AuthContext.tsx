import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
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

  const loadProfile = useCallback(async (uid: string, currentUser?: User | null) => {
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
        // Attempt to create or update profile row with upsert using onConflict: 'id'
        const { data: created, error: upsertError } = await supabase
          .from('profiles')
          .upsert(
            {
              id: uid,
              user_id: uid,
              display_name: fallbackProfile.display_name,
              tracking_key: uid,
              forwarding_active: true,
            },
            { onConflict: 'id' }
          )
          .select('*')
          .maybeSingle();

        if (upsertError) {
          console.warn('Profile upsert notice:', upsertError.message);
          // Fallback refetch in case row already exists
          const { data: refetched } = await supabase
            .from('profiles')
            .select('*')
            .or(`user_id.eq.${uid},id.eq.${uid}`)
            .maybeSingle();
          setProfile((refetched as Profile) || fallbackProfile);
        } else {
          setProfile((created as Profile) || fallbackProfile);
        }
      } else {
        setProfile(data as Profile);
      }
    } catch {
      setProfile(fallbackProfile);
    }
  }, [user]);

  const refreshProfile = useCallback(async () => {
    if (user) await loadProfile(user.id, user);
  }, [user, loadProfile]);

  useEffect(() => {
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
    const timeout = setTimeout(() => setLoading(false), 4000);

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
  }, [loadProfile]);

  async function signIn(email: string, password: string) {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Login failed';
      return { error: message };
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
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      return { error: message };
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

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
