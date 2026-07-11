import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_SIZE = 25;

export function useTransactions({ direction, page = 1, search = '', product = '', standard = '', year = '' } = {}) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['transactions', { direction, page, search, product, standard, year, supplyChainId }],
    queryFn: async () => {
      let query = supabase
        .from('transactions')
        .select('*, actors(traceability_code, contact_name), beekeepers(traceability_code, full_name)', { count: 'exact' })
        .eq('supply_chain_id', supplyChainId)
        .eq('direction', direction)
        .order('transaction_date', { ascending: false });

      if (product) query = query.eq('product', product);
      if (standard) query = query.eq('standard', standard);
      if (year) query = query.gte('transaction_date', `${year}-01-01`).lte('transaction_date', `${year}-12-31`);

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
            r.beekeepers?.full_name?.toLowerCase().includes(s)
        );
      }
      return { rows, total: count };
    },
    enabled: !!supplyChainId && !!direction,
    staleTime: 30_000,
  });
}

export function useTransaction(id) {
  return useQuery({
    queryKey: ['transaction', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('*, actors(traceability_code, contact_name, country), beekeepers(traceability_code, full_name, villages(name))')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateTransaction() {
  const queryClient = useQueryClient();
  const { supplyChainId } = useAuth();
  return useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from('transactions')
        .insert([{ ...payload, supply_chain_id: supplyChainId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transactions', { direction: variables.direction }] });
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
    },
  });
}
