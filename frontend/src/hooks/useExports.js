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
  const { supplyChainId } = useAuth();
  const queryClient = useQueryClient();

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
    queryKey: ['exports', supplyChainId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exports')
        .select('*')
        .eq('supply_chain_id', supplyChainId)
        .order('created_at', { ascending: false })
        .limit(RECENT_LIMIT);
      if (error) throw error;
      return data;
    },
    enabled: !!supplyChainId,
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
  const { supplyChainId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('exports').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exports', supplyChainId] }),
  });
}
