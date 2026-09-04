import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { identifyUser, resetIdentity } from '@/lib/posthog';
import i18n from 'i18next';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null); // row from user_accounts
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

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

  // Real, remaining half of Gap 3 (see useMyProfile.js): the value
  // itself was fixed to actually persist to the database, but nothing
  // ever read it back and applied it on load. i18next's own local
  // caching (same browser) made this easy to miss during quick manual
  // testing -- confirmed directly that AuthContext never touched i18n
  // at all, meaning a real saved preference would never actually show
  // up on a genuinely new device or browser, only whatever that
  // browser's own local cache or default detection happened to pick.
  // Same 'English'/'French' -> 'en'/'fr' mapping already used in
  // UserProfile.jsx, kept in sync with that page's own logic rather
  // than introduced as a second, potentially-diverging version.
  useEffect(() => {
    if (!profile?.language_preference) return;
    const code = profile.language_preference === 'French' ? 'fr' : profile.language_preference === 'English' ? 'en' : null;
    if (code && code !== i18n.language) i18n.changeLanguage(code);
  }, [profile?.language_preference]);

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

  // Gap 11: previously nothing detected a role change mid-session at all
  // -- someone's screen could keep showing buttons for a role they no
  // longer have until they happened to refresh manually. Not a security
  // gap (every real permission check goes through RLS, re-verified fresh
  // on every single query, never trusting stale client state) but a real
  // UX inconsistency, and the real platform explicitly forces a logout
  // when this happens. Matches that behavior deliberately rather than a
  // silent refresh -- a demoted user shouldn't keep operating with a
  // stale, more-privileged UI even briefly.
  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return undefined;

    const channel = supabase
      .channel(`role-watch-${userId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'user_accounts', filter: `id=eq.${userId}` },
        (payload) => {
          const oldRole = payload.old?.role;
          const newRole = payload.new?.role;
          if (oldRole && newRole && oldRole !== newRole) {
            signOut();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

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
    const { error } = await supabase.rpc('switch_current_actor', { p_actor_id: actorId });
    if (error) throw error;
    setProfile((prev) => ({ ...prev, current_actor_id: actorId }));
    // Invalidate every cache that RLS scopes by current_actor_id — without
    // this, already-fetched data from the PREVIOUS actor stays visible until
    // its staleTime naturally expires, which is exactly the "switching
    // actors doesn't refresh the screen" bug reported and verified earlier.
    queryClient.invalidateQueries({ queryKey: ['beekeepers'] });
    queryClient.invalidateQueries({ queryKey: ['beekeeper'] });
    queryClient.invalidateQueries({ queryKey: ['beekeeper-aggregates'] });
    queryClient.invalidateQueries({ queryKey: ['contracts'] });
    queryClient.invalidateQueries({ queryKey: ['contract'] });
    queryClient.invalidateQueries({ queryKey: ['transactions'] });
    queryClient.invalidateQueries({ queryKey: ['transaction'] });
    queryClient.invalidateQueries({ queryKey: ['stocks'] });
    queryClient.invalidateQueries({ queryKey: ['loss-records'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard-transaction-summary'] });
    queryClient.invalidateQueries({ queryKey: ['available-batches'] });
    queryClient.invalidateQueries({ queryKey: ['my-actors'] });
    // Real gap found via independent audit: "stale views after actor
    // switch". Checked every query key against this list and confirmed
    // three genuinely per-actor-scoped ones were missing -- notifications
    // even has the actor id embedded directly in its own query key, so
    // switching actors was showing stale notifications (and Commercial
    // Partners / Connections lists, both connections-scoped by the
    // current actor) left over from whichever actor was active before,
    // until something else happened to trigger a refetch.
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
    queryClient.invalidateQueries({ queryKey: ['actors'] });
    queryClient.invalidateQueries({ queryKey: ['actors-lite'] });
    queryClient.invalidateQueries({ queryKey: ['connections'] });
    // Gap 8's activity_log view unions beekeepers/stocks/transactions/
    // contracts/claims, several of which have real per-actor RLS scoping
    // (e.g. beekeepers_select checks actor_id = auth_current_actor_id()).
    // This query key was added in a later session than this invalidation
    // list and was never added to it -- confirmed live: Babs reported the
    // Activity Log showing identical results whether acting as Amina
    // Yusuf or Chinedu Okafor, two different real actors under the same
    // login. Same root cause as every other entry in this list.
    queryClient.invalidateQueries({ queryKey: ['activity-log'] });
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
        refreshProfile: () => loadProfile(session?.user?.id),
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
