import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';

import { CloudError, cloudErrorMessage } from '@/lib/cloud/errors';
import { getSupabase } from '@/lib/supabase/client';
import { isSupabaseConfigured } from '@/lib/supabase/config';

const PENDING_JOIN_KEY = 'ewidencja.pendingJoinCode';

type AuthContextValue = {
  configured: boolean;
  initializing: boolean;
  session: Session | null;
  userId: string | null;
  email: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName?: string) => Promise<'session' | 'confirm'>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const configured = isSupabaseConfigured();
  const [initializing, setInitializing] = useState(true);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!configured) {
      setInitializing(false);
      return;
    }

    const supabase = getSupabase();
    let alive = true;

    void supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setSession(data.session);
      setInitializing(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [configured]);

  useEffect(() => {
    if (!session) return;
    const user = session.user;
    void getSupabase()
      .from('profiles')
      .upsert({
        id: user.id,
        email: user.email ?? null,
      });
  }, [session]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new CloudError(cloudErrorMessage(error));
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName?: string) => {
    const { data, error } = await getSupabase().auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: displayName?.trim() ? { display_name: displayName.trim() } : undefined,
      },
    });
    if (error) throw new CloudError(cloudErrorMessage(error));
    return data.session ? 'session' : 'confirm';
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await getSupabase().auth.signOut();
    if (error) throw new CloudError(cloudErrorMessage(error));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured,
      initializing,
      session,
      userId: session?.user.id ?? null,
      email: session?.user.email ?? null,
      signIn,
      signUp,
      signOut,
    }),
    [configured, initializing, session, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth musi być użyty wewnątrz AuthProvider');
  }
  return ctx;
}

export async function storePendingJoinCode(code: string): Promise<void> {
  await AsyncStorage.setItem(PENDING_JOIN_KEY, code);
}

export async function peekPendingJoinCode(): Promise<string | null> {
  return AsyncStorage.getItem(PENDING_JOIN_KEY);
}

export async function clearPendingJoinCode(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_JOIN_KEY);
}
