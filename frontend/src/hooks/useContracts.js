import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_SIZE = 25;

export function useContracts({ page = 1, search = '', year = '', standard = '', contractType = '', country = '' } = {}) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['contracts', { page, search, year, standard, contractType, country, supplyChainId }],
    queryFn: async () => {
      let query = supabase
        .from('contracts')
        .select('*, actors(traceability_code, contact_name)', { count: 'exact' })
        .eq('supply_chain_id', supplyChainId)
        .order('created_at', { ascending: false });

      if (year) query = query.eq('year', year);
      if (standard) query = query.eq('standard', standard);
      if (contractType) query = query.eq('contract_type', contractType);
      if (country) query = query.eq('country', country);

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
            r.actors?.contact_name?.toLowerCase().includes(s) ||
            r.actors?.traceability_code?.toLowerCase().includes(s)
        );
      }
      return { rows, total: count };
    },
    enabled: !!supplyChainId,
    staleTime: 30_000,
  });
}

export function useContract(id) {
  return useQuery({
    queryKey: ['contract', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*, actors(traceability_code, contact_name)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateContract() {
  const queryClient = useQueryClient();
  const { supplyChainId } = useAuth();
  return useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from('contracts')
        .insert([{ ...payload, supply_chain_id: supplyChainId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });
}

export function useUpdateContract() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const { data, error } = await supabase
        .from('contracts')
        .update(payload)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract', variables.id] });
    },
  });
}
