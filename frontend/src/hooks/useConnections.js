import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_SIZE = 25;

export function useConnections({
  page = 1,
  search = '',
  status = '',
  connectionType = '',
  year = '',
} = {}) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['connections', { page, search, status, connectionType, year, supplyChainId }],
    queryFn: async () => {
      let query = supabase
        .from('connections')
        .select(
          '*, actor_from:actor_from_id(traceability_code, contact_name), actor_to:actor_to_id(traceability_code, contact_name)',
          { count: 'exact' }
        )
        .eq('supply_chain_id', supplyChainId)
        .order('created_at', { ascending: false });

      if (status) query = query.eq('status', status);
      if (connectionType) query = query.eq('connection_type', connectionType);
      if (year) query = query.eq('year', year);

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      let rows = data;
      if (search) {
        const s = search.toLowerCase();
        rows = rows.filter(
          (r) =>
            r.actor_from?.contact_name?.toLowerCase().includes(s) ||
            r.actor_to?.contact_name?.toLowerCase().includes(s) ||
            r.actor_from?.traceability_code?.toLowerCase().includes(s) ||
            r.actor_to?.traceability_code?.toLowerCase().includes(s)
        );
      }

      return { rows, total: count };
    },
    enabled: !!supplyChainId,
    staleTime: 30_000,
  });
}

export function useCreateConnection() {
  const { supplyChainId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from('connections')
        .insert([{ ...payload, supply_chain_id: supplyChainId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
  });
}

// Finds the connection record linking two actors (direction-agnostic — a
// connection could have either actor as actor_from/actor_to), used by the
// Enable/disable toggle on an actor's detail page.
export function useConnectionBetween(actorAId, actorBId) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['connection-between', actorAId, actorBId, supplyChainId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('connections')
        .select('*')
        .eq('supply_chain_id', supplyChainId)
        .or(
          `and(actor_from_id.eq.${actorAId},actor_to_id.eq.${actorBId}),and(actor_from_id.eq.${actorBId},actor_to_id.eq.${actorAId})`
        )
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!actorAId && !!actorBId && !!supplyChainId,
  });
}

export function useUpdateConnectionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }) => {
      const { data, error } = await supabase
        .from('connections')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['connection-between'] });
      queryClient.invalidateQueries({ queryKey: ['connections'] });
    },
  });
}
