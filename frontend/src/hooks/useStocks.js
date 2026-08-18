import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const PAGE_SIZE = 25;

export function useStock(id) {
  return useQuery({
    queryKey: ['stock', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stocks')
        .select('*, villages(name, country)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
}

// Traces which real transaction created this batch, if any -- Send/
// Receive/Processing all set destination_stock_id on the row that
// produced the batch, but this was never surfaced anywhere in the UI
// since there was no detail page for a batch to show it on.
export function useTransactionForStock(stockId) {
  return useQuery({
    queryKey: ['transaction-for-stock', stockId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('transaction_code, transaction_group_id, direction, transaction_type, transaction_date')
        .eq('destination_stock_id', stockId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!stockId,
  });
}

export function useStocks({ stockType, page = 1, search = '', product = '', standard = '', village = '', date = '' } = {}) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['stocks', { stockType, page, search, product, standard, village, date, supplyChainId }],
    queryFn: async () => {
      let query = supabase
        .from('stocks')
        .select('*, villages(name)', { count: 'exact' })
        .eq('supply_chain_id', supplyChainId)
        .eq('stock_type', stockType)
        .order('created_at', { ascending: false });

      if (product) query = query.eq('product', product);
      if (standard) query = query.eq('standard', standard);
      if (village) query = query.eq('village_id', village);
      if (date) query = query.gte('created_at', `${date}T00:00:00`).lte('created_at', `${date}T23:59:59`);

      const from = (page - 1) * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      let rows = data;
      if (search) {
        const s = search.toLowerCase();
        rows = rows.filter((r) => r.batch_reference?.toLowerCase().includes(s));
      }
      return { rows, total: count };
    },
    enabled: !!supplyChainId && !!stockType,
    staleTime: 30_000,
  });
}

export function useCreateStock() {
  const queryClient = useQueryClient();
  const { supplyChainId } = useAuth();
  return useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from('stocks')
        .insert([{ ...payload, supply_chain_id: supplyChainId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['stocks', { stockType: variables.stock_type }] });
    },
  });
}
