import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { buildContractUpdatePayloads } from '../domain/buildContractUpdatePayloads';

// Update-contract modal: Year/Actor/Standard are read-only per the audit,
// so the only things that can change are per-line-item Expected
// quantity/Maximum price, plus the shared fields (Advance amount paid,
// attachment, Updated on) applied identically to every row in the group.
// Each product row's own `id` (added to useContract's products mapping)
// targets which physical row gets which quantity/price -- Supabase
// has no single-call "update N rows with N different values" operation,
// so this issues one update per row.
export function useUpdateContractGroup() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ contractCode, products, advance_amount_paid, attachment_url, updated_at }) => {
      const payloads = buildContractUpdatePayloads(products, { advance_amount_paid, updated_at, attachment_url });

      const results = await Promise.all(payloads.map(({ id, ...payload }) =>
        supabase.from('contracts').update(payload).eq('id', id).select().single()
      ));

      const failed = results.find((r) => r.error);
      if (failed) throw failed.error;
      return results.map((r) => r.data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['contracts'] });
      queryClient.invalidateQueries({ queryKey: ['contract', variables.contractCode] });
    },
  });
}
