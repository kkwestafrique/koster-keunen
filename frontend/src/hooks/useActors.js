import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

export function useActors({ page = 1, pageSize = 5, search = '', actorType = '', country = '', status = '' } = {}) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['actors', { page, pageSize, search, actorType, country, status, supplyChainId }],
    queryFn: async () => {
      let query = supabase
        .from('actors')
        .select('*', { count: 'exact' })
        .eq('supply_chain_id', supplyChainId)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(
          `traceability_code.ilike.%${search}%,contact_name.ilike.%${search}%`
        );
      }
      if (actorType) query = query.eq('actor_type', actorType);
      if (country) query = query.eq('country', country);
      if (status) query = query.eq('status', status);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: data, total: count };
    },
    enabled: !!supplyChainId,
    staleTime: 30_000,
  });
}

export function useActor(id) {
  return useQuery({
    queryKey: ['actor', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('actors').select('*').eq('id', id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useAllActorsLite() {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['actors-lite', supplyChainId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('actors')
        .select('id, traceability_code, contact_name, actor_type, logo_url, country')
        .eq('supply_chain_id', supplyChainId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!supplyChainId,
    staleTime: 30_000,
  });
}

export function useCreateActor() {
  const { supplyChainId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from('actors')
        .insert([{ ...payload, supply_chain_id: supplyChainId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['actors'] });
      queryClient.invalidateQueries({ queryKey: ['actors-lite'] });
    },
  });
}

export function useActorTypeCounts({ country = '' } = {}) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['actor-type-counts', supplyChainId, country],
    queryFn: async () => {
      let query = supabase.from('actors').select('actor_type').eq('supply_chain_id', supplyChainId);
      if (country) query = query.eq('country', country);
      const { data, error } = await query;
      if (error) throw error;
      const counts = { Buyer: 0, 'Local Partner': 0, Aggregator: 0, 'Producer Organisation': 0 };
      data.forEach((row) => {
        counts[row.actor_type] = (counts[row.actor_type] || 0) + 1;
      });
      return { total: data.length, byType: counts };
    },
    enabled: !!supplyChainId,
    staleTime: 30_000,
  });
}

export function useUpdateActor() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const { data, error } = await supabase
        .from('actors')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['actors'] });
      queryClient.invalidateQueries({ queryKey: ['actor', data.id] });
    },
  });
}
