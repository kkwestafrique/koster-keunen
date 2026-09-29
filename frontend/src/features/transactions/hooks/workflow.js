import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

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
