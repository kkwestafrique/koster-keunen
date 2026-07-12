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

// Transaction creation: one row per product line (Received/Processing both
// support "Add more product"), sharing a transaction_group_id so the detail
// page can reconstruct the full multi-product set — matches the
// sync_transaction_to_stock DB trigger, which fires per-row and expects a
// single product/quantity (or source_product/source_quantity for
// Processing) per transaction row. Callers pass
// { products: [...], ...sharedFields } where sharedFields are the columns
// common to every row (direction, standard, actor_id, beekeeper_id,
// currency, invoice_number, bl_number, transaction_date) and each entry in
// `products` is either { product, quantity, unit, price } (Received) or
// { source_product, source_quantity, converted_product, quantity, unit }
// (Processing, mapped to product = converted_product below).
export function useCreateTransaction() {
  const queryClient = useQueryClient();
  const { supplyChainId } = useAuth();
  return useMutation({
    mutationFn: async ({ products, ...shared }) => {
      const transaction_group_id = crypto.randomUUID();
      const rows = products.map((p) => {
        const quantity = Number(p.quantity) || 0;
        const price = p.price !== '' && p.price != null ? Number(p.price) : null;
        return {
          ...shared,
          transaction_group_id,
          supply_chain_id: supplyChainId,
          product: p.converted_product ?? p.product ?? null,
          source_product: p.source_product ?? null,
          source_quantity: p.source_quantity !== undefined && p.source_quantity !== '' ? Number(p.source_quantity) : null,
          quantity,
          unit: p.unit || 'Kg',
          price,
          total_amount: price != null ? quantity * price : null,
        };
      });
      const { data, error } = await supabase
        .from('transactions')
        .insert(rows)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['transactions', { direction: variables.direction }] });
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
    },
  });
}
