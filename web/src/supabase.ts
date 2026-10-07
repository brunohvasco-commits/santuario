import { createClient, Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

// Chaves públicas (publishable) do projeto Supabase "santuario-jogo". Podem ficar no código.
const URL = import.meta.env.VITE_SUPABASE_URL || 'https://agnvebzzpzysloauhcvi.supabase.co';
const KEY = import.meta.env.VITE_SUPABASE_KEY || 'sb_publishable_pVrcKFUPp3A0mNDov3KdxQ_-WLD9fbs';

export const supabase = createClient(URL, KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  return session;
}

export const displayName = (s: Session | null | undefined) =>
  (s?.user.user_metadata?.display_name as string | undefined) || s?.user.email?.split('@')[0] || '';
