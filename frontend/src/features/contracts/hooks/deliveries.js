import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

// Adding a delivery notification was never observed live (the audit found
// no add-action on the one contract it checked, which had none recorded
// yet) -- this is a best-effort design built from the fields that WERE
// observed, not a replicated flow. Deliberately does NOT touch stocks or
// transactions: "Expected delivery date" / "Delivering quantity" read as
// a forward-looking notice of something coming, not a receipt event --
// that's what the separate Transactions module already handles. RLS
// (contract_delivery_notifications_insert) independently restricts this
// to Admin/Member, matching the UI gate below.
export function useCreateContractDelivery() {
  const queryClient = useQueryClient();
  const { supplyChainId } = useAuth();
  return useMutation({
    mutationFn: async ({ contractGroupId, product, deliveringQuantity, expectedDeliveryDate, comment }) => {
      const { data, error } = await supabase
        .from('contract_delivery_notifications')
        .insert({
          contract_group_id: contractGroupId,
          supply_chain_id: supplyChainId,
          product,
          delivering_quantity: deliveringQuantity,
          expected_delivery_date: expectedDeliveryDate,
          comment: comment || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contract-deliveries', variables.contractGroupId] });
    },
  });
}
