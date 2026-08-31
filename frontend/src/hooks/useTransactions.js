import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

// Loss list page. Loss is a NUMBER on Processing transactions
// (quantity_lost = source consumed - destination produced), not a
// separate stock entry — 'Loss' is technically a legal stocks.stock_type
// value in the schema, but nothing has ever created a row with it, and
// this app's actual loss-tracking (built earlier this session) uses a
// completely different model. The /stocks/loss page previously pointed
// at that empty dead end; this queries the real data instead.
export function useLossRecords({ page = 1, pageSize = 15, product = '', search = '' } = {}) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['loss-records', { page, pageSize, product, search, supplyChainId }],
    queryFn: async () => {
      let query = supabase
        .from('transaction_groups')
        .select('*', { count: 'exact' })
        .eq('supply_chain_id', supplyChainId)
        .eq('direction', 'Processing')
        .gt('quantity_lost', 0)
        .order('transaction_date', { ascending: false });

      if (product) query = query.eq('product', product);

      // CRITICAL fix (BUG-03, independent audit): this used to filter
      // client-side after .range() had already limited the fetch to one
      // page -- a real match sitting on any other page returned nothing.
      // Both fields searched here are real, direct columns on
      // transaction_groups, so this is a plain server-side filter, no
      // join lookup needed.
      if (search) {
        query = query.or(`transaction_code.ilike.%${search}%,product.ilike.%${search}%,source_product.ilike.%${search}%`);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      const rows = data;
      return { rows, total: count };
    },
    enabled: !!supplyChainId,
    staleTime: 30_000,
  });
}

export function useTransactions({ direction, page = 1, pageSize = 5, search = '', product = '', loggedBy = '', source = '', status = '' } = {}) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['transactions', { direction, page, pageSize, search, product, loggedBy, source, status, supplyChainId }],
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
      if (source === 'actor') query = query.not('actor_id', 'is', null);
      if (source === 'beekeeper') query = query.not('beekeeper_id', 'is', null);
      if (status) query = query.eq('status', status);

      // CRITICAL fix (BUG-03, independent audit): this used to filter
      // client-side after .range() had already limited the fetch to one
      // page -- a real match sitting on any other page returned nothing,
      // indistinguishable from search being completely broken. Matches
      // by transaction's own code/product directly, plus actor and
      // beekeeper name/code via reliable two-step lookups (rather than
      // PostgREST's embedded-resource dot-notation filtering, uncertain
      // through the JS client for a joined/embedded table).
      if (search) {
        const orParts = [`transaction_code.ilike.%${search}%`, `product.ilike.%${search}%`];
        const [{ data: matchingActors }, { data: matchingBeekeepers }] = await Promise.all([
          supabase.from('actors').select('id').eq('supply_chain_id', supplyChainId)
            .or(`contact_name.ilike.%${search}%,traceability_code.ilike.%${search}%`),
          supabase.from('beekeepers').select('id').eq('supply_chain_id', supplyChainId)
            .or(`full_name.ilike.%${search}%,traceability_code.ilike.%${search}%`),
        ]);
        const actorIds = (matchingActors || []).map((a) => a.id);
        const beekeeperIds = (matchingBeekeepers || []).map((b) => b.id);
        if (actorIds.length > 0) orParts.push(`actor_id.in.(${actorIds.join(',')})`);
        if (beekeeperIds.length > 0) orParts.push(`beekeeper_id.in.(${beekeeperIds.join(',')})`);
        query = query.or(orParts.join(','));
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      const rows = data;
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
        .select('id, transaction_code, transaction_date, direction, product, quantity, unit, total_amount, currency')
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
// DEFINITION (v1):
//   total       = count of transaction records (one row per product line,
//                 NOT one per real transaction -- a multi-product Send
//                 counts as multiple here). Deliberately NOT the same
//                 counting unit as transaction_groups elsewhere in the
//                 app; this exists to answer "how much line-item activity
//                 happened", not "how many transactions happened". Never
//                 label this on screen as a count of transactions without
//                 that distinction.
//   byDirection = SUM of quantity, grouped by direction (Received/
//                 Processing/Send). A physical quantity total, not a
//                 count.
//   byProduct   = SUM of quantity, grouped by product name. Also a
//                 physical quantity total.
export function summarizeTransactions(rows) {
  const byDirection = { Received: 0, Processing: 0, Send: 0 };
  const byProduct = {};
  rows.forEach((row) => {
    byDirection[row.direction] = (byDirection[row.direction] || 0) + (Number(row.quantity) || 0);
    if (row.product) byProduct[row.product] = (byProduct[row.product] || 0) + (Number(row.quantity) || 0);
  });
  return {
    total: rows.length,
    byDirection,
    byProduct: Object.entries(byProduct).map(([product, quantity]) => ({ product, quantity })),
  };
}

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
      return summarizeTransactions(data);
    },
    enabled: !!supplyChainId,
    staleTime: 30_000,
  });
}

// Minimal fix to keep row-clicks working, and now uses transaction_code
// (the human-readable ID) rather than the internal group UUID — matches
// the routing identity pattern already used for Contracts. Returns the
// group's shared fields plus every product line — the full 5-variant
// detail page rebuild (status badges, approval workflow, batch chips) is
// a separate, later step; this only prevents click-through from breaking.
export function useTransaction(transactionCode) {
  return useQuery({
    queryKey: ['transaction', transactionCode],
    queryFn: async () => {
      const { data: rows, error } = await supabase
        .from('transactions')
        // `actors!actor_id(...)` disambiguates the embed the same way as
        // the Contract detail fix — `transactions` also has more than one
        // FK relationship to `actors`, and an unqualified `actors(...)`
        // embed throws a PostgREST "more than one relationship" error
        // that was silently swallowed into a permanent stuck/empty state.
        .select('*, actors!actor_id(traceability_code, contact_name, country), beekeepers(traceability_code, full_name, villages(name)), stocks!destination_stock_id(batch_reference, unit)')
        .eq('transaction_code', transactionCode)
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
          destination_batch: r.stocks?.batch_reference,
        })),
        total_quantity: rows.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0),
        total_amount: rows.reduce((sum, r) => sum + (Number(r.total_amount) || 0), 0),
      };
    },
    enabled: !!transactionCode,
  });
}

// Powers the "smarter" status label on a Send transaction's own detail
// page. Real feedback: a bare "Approved" on the sender's own copy reads
// as "this is fully done and settled" even when the receiver hasn't
// confirmed yet, or has since rejected it -- confusing in both
// directions. The underlying status column stays 'Approved' immediately
// (that's still correct -- Admin-only creation is the real control, and
// stock genuinely deducts right away), this only looks up the real,
// current state of the linked Received transaction so the DISPLAYED
// label can reflect it honestly without touching the workflow itself.
export function useLinkedTransactionStatus(linkedGroupId) {
  return useQuery({
    queryKey: ['linked-transaction-status', linkedGroupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transactions')
        .select('status')
        .eq('transaction_group_id', linkedGroupId)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data?.status || null;
    },
    enabled: !!linkedGroupId,
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
    mutationFn: async ({ sourceProduct, standard, sourceBatches, destinations, transactionType, transactionDate, currency }) => {
      const { data, error } = await supabase.rpc('process_stock', {
        p_source_product: sourceProduct,
        p_standard: standard,
        p_source_batches: sourceBatches.map((b) => ({ stock_id: b.stockId, quantity: Number(b.quantity) })),
        p_destinations: destinations.map((d) => ({ product: d.product, quantity: Number(d.quantity), unit: d.unit || 'Kg' })),
        p_transaction_type: transactionType,
        p_transaction_date: transactionDate,
        p_currency: currency || null,
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

// Approval workflow. Originally Received-only (Send was immediately
// Approved at creation, Processing has no status badge at all) --
// extended to also cover Send, which now requires the same review
// before it's final. Real stock effects for Send (deducting the
// sender's own stock, creating the linked Received for the destination
// actor) are handled entirely inside approve_transaction() itself, not
// here -- this hook is just the mutation layer regardless of direction.
export function useApproveTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (transactionGroupId) => {
      // Gap #1 (Critical): transactions were not database-enforced
      // immutable -- a direct client update/delete would have been
      // allowed even though no button anywhere used one. Approving is
      // now a real function with its own explicit authorization check,
      // not a plain table update; a plain update would now silently
      // affect zero rows, since RLS blocks it entirely.
      const { error } = await supabase.rpc('approve_transaction', { p_transaction_group_id: transactionGroupId });
      if (error) throw error;
      return transactionGroupId;
    },
    onSuccess: () => {
      // The detail query is keyed by transaction_code, not group id (see
      // useTransaction above) — invalidating by group id never matched,
      // so the detail page's status badge could lag after Approve. Just
      // invalidate the whole 'transaction' prefix instead.
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction'] });
    },
  });
}

export function useRejectTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ transactionGroupId, reason, comment }) => {
      // reject_transaction_with_reversal handles both directions now.
      // For Received: marks it Rejected (reason/comment captured),
      // restores quantity to the original sender's stock as a new
      // "Returned" batch, and creates a visible "Returned" record in the
      // sender's own history -- not just a status flip. For Send: since
      // stock deduction is now deferred until approval, a still-Pending
      // Send has nothing to reverse -- rejecting one is just the status
      // flip, no cascade. Has its own explicit authorization check
      // either way (only Admin, or a Member who actually owns this
      // transaction), since it's SECURITY DEFINER.
      const { error } = await supabase.rpc('reject_transaction_with_reversal', {
        p_transaction_group_id: transactionGroupId,
        p_reject_reason: reason || null,
        p_reject_comment: comment || null,
      });
      if (error) throw error;
      return transactionGroupId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['transaction'] });
      queryClient.invalidateQueries({ queryKey: ['stocks'] });
    },
  });
}

// "Source batches" chips on Send/Processing detail pages — the batches
// actually consumed via consume_stock_batch for this transaction group.
export function useTransactionBatchSelections(transactionGroupId) {
  return useQuery({
    queryKey: ['transaction-batch-selections', transactionGroupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('transaction_batch_selections')
        .select('id, quantity_selected, stocks(id, batch_reference, unit)')
        .eq('transaction_group_id', transactionGroupId);
      if (error) throw error;
      return data;
    },
    enabled: !!transactionGroupId,
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
