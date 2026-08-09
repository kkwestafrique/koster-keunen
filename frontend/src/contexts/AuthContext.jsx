import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { identifyUser, resetIdentity } from '@/lib/posthog';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // row from user_accounts
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    const { data, error } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (!error) setProfile(data);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      loadProfile(data.session?.user?.id).finally(() => setLoading(false));
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
      loadProfile(currentSession?.user?.id);
    });

    return () => subscription.subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data?.user) identifyUser(data.user.id, { email: data.user.email });
    return data;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    resetIdentity();
  };

  const switchActor = async (actorId) => {
    if (!profile) return;
    // Uses the switch_current_actor RPC (not a raw update) -- it validates
    // server-side that this person actually has an active team_members
    // row on the target actor before allowing the switch, rather than
    // trusting the client to only ever pass a valid id.
    const { error } = await supabase.rpc('switch_current_actor', { p_actor_id: actorId });
    if (error) throw error;
    setProfile((prev) => ({ ...prev, current_actor_id: actorId }));
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user || null,
        profile,
        loading,
        signIn,
        signOut,
        switchActor,
        role: profile?.role || 'Field Officer',
        supplyChainId: profile?.supply_chain_id || null,
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
