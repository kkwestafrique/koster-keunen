import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { shapeTransactionDetail } from '../domain/shapeTransactionDetail';

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
      return shapeTransactionDetail(rows);
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
