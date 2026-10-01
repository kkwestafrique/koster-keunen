import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { buildContractRows } from '../domain/buildContractRows';

// Contract creation: one row per product line (the live site's "Add more
// products" step means a single contract-creation action can cover multiple
// products), sharing a contract_group_id so the detail page can reconstruct
// the full multi-product set. Callers pass { products: [...], ...sharedFields }
// where sharedFields are the columns common to every row (year, standard,
// actor_id, currency, contract_type, country, advance_amount_paid,
// advance_percent, comments, signature_date) and each entry in `products` is
// { product, expected_quantity, unit, price }.
export function useCreateContract() {
  const queryClient = useQueryClient();
  const { supplyChainId } = useAuth();
  return useMutation({
    // contract_group_id now comes from the caller instead of being
    // generated fresh in here -- the caller (ContractWizard) creates it
    // once, when the form first mounts, and reuses the same id across
    // any retry of the same submission. That's what makes the check
    // below meaningful: a genuine network retry (the insert actually
    // succeeded server-side, the client just never got the response)
    // arrives here with the *same* group id as the original attempt,
    // not a fresh random one every time.
    mutationFn: async ({ products, contract_group_id, ...shared }) => {
      if (!contract_group_id) throw new Error('contract_group_id is required');

      // Real idempotency check, not just a client-side double-click
      // guard: if rows with this exact group id already exist, this is
      // a retry of a submission that already succeeded -- return those
      // rows instead of inserting a second, duplicate contract.
      const { data: existing, error: existingErr } = await supabase
        .from('contracts').select().eq('contract_group_id', contract_group_id);
      if (existingErr) throw existingErr;
      if (existing && existing.length > 0) return existing;

      const rows = buildContractRows(products, { ...shared, contract_group_id, supply_chain_id: supplyChainId });
      const { data, error } = await supabase
        .from('contracts')
        .insert(rows)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
    },
  });
}
