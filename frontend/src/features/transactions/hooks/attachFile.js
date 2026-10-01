import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

// Real fix for a security-audit finding: the attachment used to be a
// direct link to a permanent, public URL. The file itself is uploaded to
// a private storage bucket by the caller (uploadMediaFile); this just
// records the resulting path against the transaction group via the
// attach_transaction_file RPC, which independently enforces who's
// allowed to attach a file to this transaction (SECURITY DEFINER, not a
// plain table update).
//
// Deliberately has no onSuccess/invalidateQueries -- the original inline
// version didn't either (confirmed: zero invalidateQueries/refetch calls
// anywhere in the original TransactionDetail.jsx), so none was added
// here. Extraction preserves behavior exactly, including gaps.
export function useAttachTransactionFile() {
  return useMutation({
    mutationFn: async ({ transactionGroupId, attachmentUrl }) => {
      const { error } = await supabase.rpc('attach_transaction_file', {
        p_transaction_group_id: transactionGroupId,
        p_attachment_url: attachmentUrl,
      });
      if (error) throw error;
    },
  });
}
