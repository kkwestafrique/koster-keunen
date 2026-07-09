import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_SIZE = 25;

export function useBeekeepers({
  page = 1,
  search = '',
  gender = '',
  villageId = '',
  status = '',
} = {}) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['beekeepers', { page, search, gender, villageId, status, supplyChainId }],
    queryFn: async () => {
      let query = supabase
        .from('beekeepers')
        .select('*, villages(name), actors(contact_name, traceability_code)', { count: 'exact' })
        .eq('supply_chain_id', supplyChainId)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`traceability_code.ilike.%${search}%,full_name.ilike.%${search}%`);
      }
      if (gender) query = query.eq('gender', gender);
      if (villageId) query = query.eq('village_id', villageId);
      if (status) query = query.eq('status', status);

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;
      return { rows: data, total: count };
    },
    enabled: !!supplyChainId,
    staleTime: 30_000,
  });
}

export function useBeekeeper(id) {
  return useQuery({
    queryKey: ['beekeeper', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('beekeepers')
        .select('*, villages(name, country), actors(contact_name, traceability_code)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateBeekeeper() {
  const { supplyChainId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from('beekeepers')
        .insert([{ ...payload, supply_chain_id: supplyChainId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beekeepers'] });
    },
  });
}

export function useUpdateBeekeeper() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const { data, error } = await supabase
        .from('beekeepers')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['beekeepers'] });
      queryClient.invalidateQueries({ queryKey: ['beekeeper', data.id] });
    },
  });
}
