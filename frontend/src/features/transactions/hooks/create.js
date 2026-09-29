import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { buildTransactionRows } from '../domain/buildTransactionRows';

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
// (Processing, mapped to product = converted_product by buildTransactionRows).
export function useCreateTransaction() {
  const queryClient = useQueryClient();
  const { supplyChainId } = useAuth();
  return useMutation({
    // transaction_group_id now comes from the caller (generated once,
    // at form-mount time) instead of being generated fresh on every
    // call -- same fix, same reasoning as useCreateContract. This one
    // hook is shared by Receive/Send/Process Stock, so this single fix
    // covers all three forms.
    mutationFn: async ({ products, transaction_group_id, ...shared }) => {
      if (!transaction_group_id) throw new Error('transaction_group_id is required');

      // Real idempotency check: if rows with this exact group id
      // already exist, this is a retry of an already-successful
      // submission -- return those rows instead of inserting a second,
      // duplicate transaction (and, downstream, double-counting stock).
      const { data: existing, error: existingErr } = await supabase
        .from('transactions').select().eq('transaction_group_id', transaction_group_id);
      if (existingErr) throw existingErr;
      if (existing && existing.length > 0) return existing;

      const rows = buildTransactionRows(products, { ...shared, transaction_group_id, supply_chain_id: supplyChainId });
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
