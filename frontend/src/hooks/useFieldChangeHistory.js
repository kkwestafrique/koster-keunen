import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

// Gap 9 (Medium, Phase 9): field-level change tracking ("what changed,
// from what to what"), scoped to Transactions, Contracts, and Stocks
// only, Admin-only viewing -- both decisions confirmed with Babs. The
// field_change_log table's own RLS SELECT policy independently enforces
// the Admin restriction (auth_role() = 'Admin'), so this hook returning
// data at all already implies the caller is allowed to see it.
//
// Stocks are single-row entities (StockDetail is keyed by the row's own
// id), but Contracts and Transactions are GROUPED -- multiple product
// lines share one contract_group_id / transaction_group_id, each as its
// own row with its own id. The trigger that writes field_change_log
// extracts that group id into its own group_id column, so grouped
// entities filter on group_id and single-row entities filter on
// record_id directly.
export function useFieldChangeHistory({ tableName, recordId, groupId }) {
  const { supplyChainId } = useAuth();
  const { data: users } = useSupplyChainUsernames();

  return useQuery({
    queryKey: ['field-change-history', tableName, recordId, groupId],
    queryFn: async () => {
      let query = supabase.from('field_change_log').select('*').eq('table_name', tableName);
      query = groupId ? query.eq('group_id', groupId) : query.eq('record_id', recordId);
      const { data, error } = await query.order('changed_at', { ascending: false });
      if (error) throw error;

      const nameById = new Map((users || []).map((u) => [u.id, u.username]));
      return (data || []).map((row) => ({
        ...row,
        changed_by_name: row.changed_by ? (nameById.get(row.changed_by) || null) : null,
      }));
    },
    enabled: !!supplyChainId && (!!recordId || !!groupId),
  });
}

// Same narrowly-scoped lookup already introduced for Gap 8's activity
// log -- reused here rather than duplicated, since it does exactly what
// this hook needs (resolve a supply-chain teammate's name from their id).
function useSupplyChainUsernames() {
  return useQuery({
    queryKey: ['supply-chain-usernames'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_supply_chain_usernames');
      if (error) throw error;
      return data;
    },
  });
}
