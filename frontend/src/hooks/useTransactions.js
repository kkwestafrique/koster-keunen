import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

export function useTransactions({ direction, page = 1, pageSize = 5, search = '', product = '', loggedBy = '' } = {}) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['transactions', { direction, page, pageSize, search, product, loggedBy, supplyChainId }],
    queryFn: async () => {
      // Query the transaction_groups view (one row per real transaction,
      // multi-product lines aggregated) rather than the raw transactions
      // table, which is one row per product line for Received/Processing
      // and would otherwise show a multi-product transaction as several
      // separate rows — same class of bug fixed for Contracts.
      let query = supabase
        .from('transaction_groups')
        .select('*, actors(traceability_code, contact_name), beekeepers(traceability_code, full_name), user_accounts(username)', { count: 'exact' })
        .eq('supply_chain_id', supplyChainId)
        .eq('direction', direction)
        .order('transaction_date', { ascending: false });

      if (product) query = query.eq('product', product);
      if (loggedBy) query = query.eq('logged_by', loggedBy);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
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

// "Person" filter on all three lists (audit: "All transactions, Abimbola,
// Oluwafemi Awoyemi") — only lists staff who've actually logged a
// transaction, not every team member, matching what the live site showed.
export function useTransactionLoggers() {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['transaction-loggers', supplyChainId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('logged_by, user_accounts(id, username)')
        .eq('supply_chain_id', supplyChainId)
        .not('logged_by', 'is', null);
      if (error) throw error;
      const seen = new Map();
      data.forEach((r) => {
        if (r.user_accounts && !seen.has(r.user_accounts.id)) {
          seen.set(r.user_accounts.id, r.user_accounts.username);
        }
      });
      return Array.from(seen, ([value, label]) => ({ value, label }));
    },
    enabled: !!supplyChainId,
  });
}

// Transactions where this actor is the counterpart (currently only Send
// rows set actor_id — Received rows link to a beekeeper instead). Used by
// the Transactions tab on an actor's detail page.
export function useActorTransactions(actorId) {
  return useQuery({
    queryKey: ['actor-transactions', actorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, transaction_date, direction, product, quantity, unit, total_amount, currency')
        .eq('actor_id', actorId)
        .order('transaction_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!actorId,
  });
}

export function useBeekeeperTransactions(beekeeperId) {
  return useQuery({
    queryKey: ['beekeeper-transactions', beekeeperId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, transaction_date, direction, product, quantity, unit, total_amount, currency')
        .eq('beekeeper_id', beekeeperId)
        .order('transaction_date', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!beekeeperId,
  });
}

// Transaction Overview tab on the Dashboard: total quantity per direction
// for the selected year, plus a per-product breakdown for Received (the
// most common direction to actually have volume in early on).
export function useDashboardTransactionSummary({ year = '' } = {}) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['dashboard-transaction-summary', supplyChainId, year],
    queryFn: async () => {
      let query = supabase
        .from('transactions')
        .select('direction, product, quantity, total_amount')
        .eq('supply_chain_id', supplyChainId);
      if (year) query = query.gte('transaction_date', `${year}-01-01`).lte('transaction_date', `${year}-12-31`);

      const { data, error } = await query;
      if (error) throw error;

      const byDirection = { Received: 0, Processing: 0, Send: 0 };
      const byProduct = {};
      data.forEach((row) => {
        byDirection[row.direction] = (byDirection[row.direction] || 0) + (Number(row.quantity) || 0);
        if (row.product) byProduct[row.product] = (byProduct[row.product] || 0) + (Number(row.quantity) || 0);
      });

      return {
        total: data.length,
        byDirection,
        byProduct: Object.entries(byProduct).map(([product, quantity]) => ({ product, quantity })),
      };
    },
    enabled: !!supplyChainId,
    staleTime: 30_000,
  });
}

// Minimal fix to keep row-clicks working now that lists navigate using
// transaction_group_id (the aggregated view has no per-row id). Returns
// the group's shared fields plus every product line — the full 5-variant
// detail page rebuild (status badges, approval workflow, batch chips) is
// a separate, later step; this only prevents click-through from breaking.
export function useTransaction(groupId) {
  return useQuery({
    queryKey: ['transaction', groupId],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('transactions')
        .select('*, actors(traceability_code, contact_name, country), beekeepers(traceability_code, full_name, villages(name))')
        .eq('transaction_group_id', groupId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (!rows.length) return null;

      const [first] = rows;
      return {
        ...first,
        products: rows.map((r) => ({
          id: r.id,
          product: r.product,
          quantity: r.quantity,
          unit: r.unit,
          price: r.price,
          total_amount: r.total_amount,
        })),
        total_quantity: rows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0),
        total_amount: rows.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0),
      };
    },
    enabled: !!groupId,
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
    enabled: !!supplyChainId && !!product && !!stockType,
  });
}

// Atomically consumes one selected batch via the consume_stock_batch()
// Postgres function (row-locked, validates availability, decrements, and
// records the selection) — called once per selected batch after the
// transaction row(s) exist.
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
