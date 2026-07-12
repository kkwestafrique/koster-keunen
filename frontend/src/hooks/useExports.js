import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const RECENT_LIMIT = 15;

// Powers the TopBar downloads panel: a live list of report exports for the
// current supply chain, updated in real time via Supabase Realtime as rows
// are inserted (Inprogress) and then updated (Completed/Failed) — no
// polling needed.
export function useRecentExports() {
  const { supplyChainId } = useAuth();
  const queryClient = useQueryClient();

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
