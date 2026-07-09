import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_SIZE = 25;

export function useVillages({ page = 1, search = '' } = {}) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['villages', { page, search, supplyChainId }],
    queryFn: async () => {
      let query = supabase
        .from('villages')
        .select('*', { count: 'exact' })
        .eq('supply_chain_id', supplyChainId)
        .order('created_at', { ascending: false });

      if (search) query = query.ilike('name', `%${search}%`);

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      const villageIds = data.map((v) => v.id);
      let counts = {};
      if (villageIds.length) {
        const { data: bkData, error: bkError } = await supabase
          .from('beekeepers')
          .select('village_id')
          .in('village_id', villageIds);
        if (!bkError) {
          counts = bkData.reduce((acc, row) => {
            acc[row.village_id] = (acc[row.village_id] || 0) + 1;
            return acc;
          }, {});
        }
      }

      const rows = data.map((v) => ({ ...v, beekeeper_count: counts[v.id] || 0 }));
      return { rows, total: count };
    },
    enabled: !!supplyChainId,
    staleTime: 30_000,
  });
}

export function useAllVillagesLite() {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['villages-lite', supplyChainId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('villages')
        .select('id, name')
        .eq('supply_chain_id', supplyChainId)
        .order('name', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!supplyChainId,
    staleTime: 30_000,
  });
}

export function useCreateVillage() {
  const { supplyChainId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from('villages')
        .insert([{ ...payload, supply_chain_id: supplyChainId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['villages'] });
      queryClient.invalidateQueries({ queryKey: ['villages-lite'] });
    },
  });
}
