import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { isSupabaseConfigured } from '@/config/env';
import { getSupabaseClient } from '@/services/supabase';

export type AdminProfile = {
  role: 'admin';
  business_id: string;
};

type AuthState = {
  loading: boolean;
  userId: string | null;
  profile: AdminProfile | null;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

async function loadAdminProfile(userId: string): Promise<AdminProfile | null> {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, business_id')
    .eq('id', userId)
    .maybeSingle();

  if (!profile || profile.role !== 'admin' || !profile.business_id) {
    return null;
  }

  return { role: 'admin', business_id: profile.business_id };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<AdminProfile | null>(null);

  const refreshProfile = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      setUserId(null);
      setProfile(null);
      return;
    }

    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id ?? null;
    setUserId(uid);
    if (!uid) {
      setProfile(null);
      return;
    }

    const admin = await loadAdminProfile(uid);
    if (!admin) {
      await supabase.auth.signOut();
      setUserId(null);
      setProfile(null);
      return;
    }
    setProfile(admin);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true;
    void (async () => {
      await refreshProfile();
      if (active) {
        setLoading(false);
      }
    })();

    const { data: subscription } = supabase.auth.onAuthStateChange(() => {
      void refreshProfile();
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [refreshProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabaseClient();
    if (!supabase) {
      return { error: 'Supabase is not configured.' };
    }

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError || !data.user) {
      return { error: signInError?.message ?? 'Could not sign in. Check the email and password.' };
    }

    const admin = await loadAdminProfile(data.user.id);
    if (!admin) {
      await supabase.auth.signOut();
      return { error: 'This account is not authorized for delivery.' };
    }

    setUserId(data.user.id);
    setProfile(admin);
    return { error: null };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUserId(null);
    setProfile(null);
  }, []);

  const value = useMemo(
    () => ({
      loading,
      userId,
      profile,
      signIn,
      signOut,
      refreshProfile,
    }),
    [loading, userId, profile, signIn, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
