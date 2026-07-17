import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import type { Profile } from '../types/domain';

/**
 * Maneja la sesión de Supabase Auth y carga el perfil del usuario
 * (con su org_id y rol). RLS hace el resto en cada query.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (!data.session) setIsLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) {
        setProfile(null);
        setIsLoading(false);
      }
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    let isMounted = true;
    supabase
      .from('profiles')
      .select('user_id, org_id, full_name, role')
      .eq('user_id', session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!isMounted) return;
        setProfile(data);
        setIsLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [session]);

  const signIn = (email: string, password: string) => supabase.auth.signInWithPassword({ email, password });

  const signOut = () => supabase.auth.signOut();

  return { session, profile, isLoading, signIn, signOut };
}
