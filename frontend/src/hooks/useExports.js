import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const RECENT_LIMIT = 15;
const STALE_EXPORT_MINUTES = 5;

// Powers the TopBar downloads panel: a live list of report exports for the
// current supply chain, updated in real time via Supabase Realtime as rows
// are inserted (Inprogress) and then updated (Completed/Failed) — no
// polling needed.
export function useRecentExports() {
  const { supplyChainId, role, session } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  // Real gap found while investigating the top-bar Download button
  // throwing errors on click: this list was scoped only by
  // supply_chain_id -- tenant-wide, showing every teammate's exports --
  // while the storage policy that actually lets someone open a file
  // only allows the real creator (or an Admin). A non-Admin saw every
  // export listed here but could only open their own; clicking anyone
  // else's threw a real, live permission error. Scoping the list to
  // match what's actually openable (own exports, or everything if
  // Admin) means what's shown here is what can actually be opened.

  // Recover from the "stuck at Inprogress forever" failure mode: if the
  // browser tab closed, the network dropped, or the browser crashed while
  // a report was being generated client-side, that export row is left
  // permanently at Inprogress with no way to retry or recover. On load,
  // mark anything that's been Inprogress for more than 5 minutes as Failed
  // — if it hasn't finished by then, it never will.
  useEffect(() => {
    if (!supplyChainId) return;
    const cutoff = new Date(Date.now() - STALE_EXPORT_MINUTES * 60 * 1000).toISOString();
    supabase
      .from('exports')
      .update({ status: 'Failed', error_message: 'Timed out — the browser tab was likely closed before this report finished generating.' })
      .eq('status', 'Inprogress')
      .eq('supply_chain_id', supplyChainId)
      .lt('created_at', cutoff)
      .then(({ error }) => {
        if (!error) queryClient.invalidateQueries({ queryKey: ['exports', supplyChainId] });
      });
  }, [supplyChainId, queryClient]);

  const query = useQuery({
    queryKey: ['exports', supplyChainId, role === 'Admin' ? 'all' : userId],
    queryFn: async () => {
      let q = supabase
        .from('exports')
        .select('*')
        .eq('supply_chain_id', supplyChainId)
        .order('created_at', { ascending: false })
        .limit(RECENT_LIMIT);
      if (role !== 'Admin') q = q.eq('created_by', userId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    // supplyChainId and userId both come from the same profile object
    // in AuthContext, so they resolve together -- but guarding on both
    // explicitly (rather than assuming) means this can't fire with a
    // half-resolved auth state for a non-Admin user and silently query
    // with created_by = undefined.
    enabled: !!supplyChainId && (role === 'Admin' || !!userId),
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!supplyChainId) return undefined;
    const channel = supabase
      .channel(`exports-${supplyChainId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'exports', filter: `supply_chain_id=eq.${supplyChainId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['exports', supplyChainId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supplyChainId, queryClient]);

  return query;
}

export function useCreateExport() {
  const { supplyChainId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reportKey, fileName }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('exports')
        .insert([{
          supply_chain_id: supplyChainId,
          report_key: reportKey,
          file_name: fileName,
          status: 'Inprogress',
          created_by: userData?.user?.id || null,
        }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exports', supplyChainId] }),
  });
}

export function useUpdateExport() {
  const { supplyChainId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }) => {
      const { data, error } = await supabase
        .from('exports')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exports', supplyChainId] }),
  });
}

// Third entity in the deliberately scoped-down Delete rollout (after
// villages, connections). Confirmed directly: zero foreign keys anywhere
// reference exports, safe to delete. Deliberately scoped to just the
// notification/history row itself, not the underlying stored file (if
// still present) -- matches the same scope as villages/connections,
// which also don't touch anything beyond their own row.
export function useDeleteExport() {
  const { supplyChainId, role, session } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();
  // Must match useRecentExports' queryKey exactly -- setQueryData below
  // needs an exact cache-key match, unlike invalidateQueries elsewhere
  // in this file, which matches by prefix and would have kept working
  // fine even with a mismatched key here. Missed initially when the
  // list query's key grew a third segment; the optimistic delete would
  // have silently targeted a nonexistent cache entry (no error, item
  // just wouldn't disappear until the next real refetch).
  const queryKey = ['exports', supplyChainId, role === 'Admin' ? 'all' : userId];
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('exports').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    },
    // Real, genuine cache-level optimistic delete -- safe here (unlike
    // Villages/Connections, which use a local "pending" set instead)
    // because this is a simple, non-paginated flat list with no total
    // count or page-boundary math that could be gotten subtly wrong.
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (old) => (old || []).filter((e) => e.id !== id));
      return { previous };
    },
    onError: (err, id, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey }),
  });
}
