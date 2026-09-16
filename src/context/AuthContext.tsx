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
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(uid: string) {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', uid)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        const { data: created, error: createError } = await supabase
          .from('profiles')
          .insert({ user_id: uid, display_name: null })
          .select('*')
          .maybeSingle();
        if (createError) throw createError;
        setProfile(created as Profile | null);
      } else {
        setProfile(data as Profile);
      }
    } catch {
      setProfile(null);
    }
  }

  async function refreshProfile() {
    if (user) await loadProfile(user.id);
  }

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    supabase.auth.getSession()
      .then(({ data }) => {
        setSession(data.session);
        setUser(data.session?.user ?? null);
        if (data.session?.user) {
          loadProfile(data.session.user.id).finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch(() => {
        setLoading(false);
      });

    // Safety: never stay stuck on loading longer than 5 seconds
    timeout = setTimeout(() => setLoading(false), 5000);

    const { data: listener } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (event === 'SIGNED_OUT') {
        setProfile(null);
      }
      if (newSession?.user) {
        (async () => {
          await loadProfile(newSession.user.id);
        })();
      }
    });

    return () => {
      clearTimeout(timeout);
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      try {
        await supabase.from('profiles').insert({ user_id: data.user.id });
      } catch {
        // profile creation may fail if RLS blocks it — will be auto-created on first login
      }
    }
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setProfile(null);
  }

  return (
    <AuthContext.Provider value={{ session, user, profile, loading, signIn, signUp, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
