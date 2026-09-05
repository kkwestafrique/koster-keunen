import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const RECENT_LIMIT = 20;

// Scoped by actor (not individual person), matching how the rest of this
// app works: anyone on the relevant actor's team, whoever's currently
// acting as that actor, sees the same notifications. Live via Supabase
// Realtime, same pattern as useRecentExports — no polling needed.
export function useNotifications() {
  const { profile, supplyChainId } = useAuth();
  const currentActorId = profile?.current_actor_id;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications', currentActorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('actor_id', currentActorId)
        .order('created_at', { ascending: false })
        .limit(RECENT_LIMIT);
      if (error) throw error;
      return data;
    },
    enabled: !!currentActorId,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!currentActorId) return undefined;
    const channel = supabase
      .channel(`notifications-${currentActorId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `actor_id=eq.${currentActorId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications', currentActorId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentActorId, queryClient]);

  return query;
}

export function useMarkNotificationRead() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['notifications', profile?.current_actor_id];
  return useMutation({
    mutationFn: async (notificationId) => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);
      if (error) throw error;
    },
    // Real, deliberate optimistic UI: marking a notification read has
    // no financial, inventory, or compliance risk at all -- the exact
    // opposite of this app's core transactional mutations (Process/
    // Send/Receive Stock, transaction approvals), which stay
    // server-confirmed because real inventory mass-balance and
    // approval-workflow rules genuinely need the server's own
    // validation before the UI can honestly say something happened.
    onMutate: async (notificationId) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old) =>
        (old || []).map((n) => (n.id === notificationId ? { ...n, read_at: new Date().toISOString() } : n))
      );
      return { previous };
    },
    onError: (err, notificationId, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}

export function useMarkAllNotificationsRead() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const queryKey = ['notifications', profile?.current_actor_id];
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('actor_id', profile?.current_actor_id)
        .is('read_at', null);
      if (error) throw error;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      const now = new Date().toISOString();
      queryClient.setQueryData(queryKey, (old) => (old || []).map((n) => (n.read_at ? n : { ...n, read_at: now })));
      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}
