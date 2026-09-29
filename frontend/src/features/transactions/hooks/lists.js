import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { summarizeTransactions } from '../domain/summarizeTransactions';
import { dedupeLoggers } from '../domain/dedupeLoggers';

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
        // Real bug found via independent audit (BUG-22): "Loss report
        // lists only 2 of the processing transactions, missing the
        // BUG-01 example". Traced precisely: the two real, pre-existing
        // corrupted records from before the BUG-01 mass-balance fix
        // have NEGATIVE quantity_lost (-22, -85 -- output exceeded
        // input, so this "loss" is actually a phantom gain). The old
        // .gt('quantity_lost', 0) filter silently excluded exactly the
        // records a loss report should be flagging loudest. Changed to
        // .neq(0) so both real loss and impossible negative anomalies
        // both surface; the render below visually distinguishes them.
        .neq('quantity_lost', 0)
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
      return dedupeLoggers(data);
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
