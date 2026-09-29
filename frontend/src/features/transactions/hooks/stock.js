import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

// Real bug found via independent audit (BUG-29): the Source product
// dropdown in Process Stock pulled from a static, hardcoded list of
// every possible product in the system, completely unfiltered by
// whether the current actor actually has any real stock of it --
// guaranteed to lead to the exact dead-end the "you have X Kg
// available" hint (built earlier this session) was meant to catch,
// just one step later than necessary. Returns the distinct list of
// products with genuinely available stock for the given stock type;
// RLS on stocks already scopes this to the current actor, matching
// useAvailableBatches' own convention of relying on RLS rather than an
// explicit actor filter.
export function useProductsWithStock({ stockType }) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['products-with-stock', { stockType, supplyChainId }],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stocks')
        .select('product')
        .eq('supply_chain_id', supplyChainId)
        .eq('stock_type', stockType)
        .gt('quantity_available', 0);
      if (error) throw error;
      return [...new Set((data || []).map((r) => r.product))].sort();
    },
    enabled: !!supplyChainId && !!stockType,
  });
}

// Batch-picker: available batches for a given product/standard/stock type,
// oldest first (FIFO-friendly default ordering — selection itself is
// manual, not auto-picked, per the audit's "Add batch details" modal).
export function useAvailableBatches({ product, standard, stockType }) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['available-batches', { product, standard, stockType, supplyChainId }],
    queryFn: async () => {
      let query = supabase
        .from('stocks')
        .select('id, batch_reference, quantity_available, unit, created_at')
        .eq('supply_chain_id', supplyChainId)
        .eq('stock_type', stockType)
        .eq('product', product)
        .gt('quantity_available', 0)
        .order('created_at', { ascending: true });
      if (standard) query = query.eq('standard', standard);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    // Real gap found via QA report (KKWA-MIS-QA-Report, issue #6): the
    // "X Kg available" hint on Send/Process forms briefly showed 0/stale
    // right after picking a product, only correcting once the field was
    // re-triggered. Root cause: `product` is part of the query key, so
    // TanStack Query clears `data` to undefined the instant it changes,
    // while the new query is in flight -- the caller's `= []` fallback
    // then renders as a real "0 Kg available", indistinguishable from an
    // actually-empty batch. keepPreviousData shows the last real result
    // until the new one resolves, so the UI never shows a false zero.
    placeholderData: keepPreviousData,
    enabled: !!supplyChainId && !!product && !!stockType,
  });
}

// Atomically consumes one selected batch via the consume_stock_batch()
// Postgres function (row-locked, validates availability, decrements, and
// records the selection) — called once per selected batch after the
// transaction row(s) exist.
// CRITICAL fix from the independent BeezTrace QA audit (BUG-01):
// Processing used to create the transaction row and consume batches as
// two separate, sequential steps -- output stock creation fired the
// instant the transaction row existed, with no way to check it against
// what was actually consumed, since consumption happened afterward.
// The audit demonstrated this let a person "process" 5 Kg of real
// stock into 900 Kg of real, sellable output. This hook replaces that
// two-step flow with a single atomic database call: consumption,
// mass-balance verification, and transaction creation all happen
// together, all-or-nothing. source_quantity and quantity_lost are
// computed from real, verified numbers inside the function -- never
// accepted as trusted input from the form.
export function useProcessStock() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sourceProduct, standard, sourceBatches, destinations, transactionType, transactionDate, currency, idempotencyKey }) => {
      const { data, error } = await supabase.rpc('process_stock', {
        p_source_product: sourceProduct,
        p_standard: standard,
        p_source_batches: sourceBatches.map((b) => ({ stock_id: b.stockId, quantity: Number(b.quantity) })),
        p_destinations: destinations.map((d) => ({ product: d.product, quantity: Number(d.quantity), unit: d.unit || 'Kg' })),
        p_transaction_type: transactionType,
        p_transaction_date: transactionDate,
        p_currency: currency || null,
        p_idempotency_key: idempotencyKey,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      queryClient.invalidateQueries({ queryKey: ['available-batches'] });
    },
  });
}

export function useConsumeStockBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ stockId, quantity, transactionGroupId }) => {
      const { error } = await supabase.rpc('consume_stock_batch', {
        p_stock_id: stockId,
        p_quantity: quantity,
        p_transaction_group_id: transactionGroupId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
      queryClient.invalidateQueries({ queryKey: ['available-batches'] });
    },
  });
}

// Send's new approval workflow: real stock deduction is deferred until
// an Admin/Member actually approves the Send (see approve_transaction),
// not immediate at creation like Processing. This only records which
// batch was intended -- consume_stock_batch (above) still does both in
// one step, unchanged, for Processing.
export function useRecordBatchSelection() {
  return useMutation({
    mutationFn: async ({ stockId, quantity, transactionGroupId }) => {
      const { error } = await supabase.rpc('record_batch_selection', {
        p_stock_id: stockId,
        p_quantity: quantity,
        p_transaction_group_id: transactionGroupId,
      });
      if (error) throw error;
    },
  });
}
