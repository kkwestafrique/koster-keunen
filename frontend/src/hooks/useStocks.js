import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const DEFAULT_PAGE_SIZE = 5;

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

export function useStocks({ stockType, page = 1, pageSize = DEFAULT_PAGE_SIZE, search = '', product = '', standard = '', village = '', dateFrom = '', dateTo = '' } = {}) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['stocks', { stockType, page, pageSize, search, product, standard, village, dateFrom, dateTo, supplyChainId }],
    queryFn: async () => {
      let query = supabase
        .from('stocks')
        .select('*, villages(name)', { count: 'exact' })
        .eq('supply_chain_id', supplyChainId)
        .eq('stock_type', stockType)
        // Real feedback: batches should sort by how much stock is
        // actually there, highest first, rather than by when they were
        // created -- easier to see what's actually available at a
        // glance instead of hunting through creation-date order.
        .order('quantity_available', { ascending: false });

      if (product) query = query.eq('product', product);
      if (standard) query = query.eq('standard', standard);
      if (village) query = query.eq('village_id', village);
      // Real UX limitation fixed here: this used to only match one exact
      // calendar day, which meant knowing the precise creation date of a
      // batch to find it at all. Now a genuine from/to range -- either
      // end can be used alone.
      if (dateFrom) query = query.gte('created_at', `${dateFrom}T00:00:00`);
      if (dateTo) query = query.lte('created_at', `${dateTo}T23:59:59`);
      // Real bug fixed here: this used to run AFTER .range() had already
      // limited results to one page, so it only ever searched whatever
      // 25 rows happened to be on the CURRENT page -- a match on a
      // different page would silently return nothing. Moved into the
      // actual query, before pagination, so it searches the full,
      // correctly-scoped dataset and paginates the real results.
      if (search) query = query.ilike('batch_reference', `%${search}%`);

      // CRITICAL fix (BUG-02, independent audit): this used to calculate
      // the range using a hardcoded PAGE_SIZE=25 constant completely
      // disconnected from what the UI actually showed and let someone
      // select (DataTable's own "Items per page" control, defaulting to
      // 5). If there were fewer than 25 real rows, clicking to a page
      // number the UI itself calculated as valid would request a range
      // starting beyond the real data -- Postgres/PostgREST correctly
      // returns HTTP 416 for that, which surfaced as a permanent
      // "Loading..." state with no error shown. Now pageSize is a real
      // parameter, the same value driving both the UI's page-count math
      // and the actual database range.
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      return { rows: data, total: count };
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
