import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

// Gap 8 (Medium, Phase 1): no dedicated audit-history screen existed --
// the who/when data was real but scattered across individual records.
// activity_log is a security_invoker view (Postgres respects each
// underlying table's own RLS through it, verified directly against the
// live database rather than assumed) unioning actors, beekeepers,
// contracts, stocks, transactions, and claims into one feed.
//
// created_by/updated_by only carry back a UUID -- user_accounts' own RLS
// only lets someone read their own row, so resolving a teammate's name
// needs the narrowly-scoped get_supply_chain_usernames() RPC (same
// SECURITY DEFINER pattern already used elsewhere in this app), fetched
// once and joined here rather than requiring the DB layer to reimplement
// each table's RLS scoping logic just to show a name.
export function useActivityLog() {
  const { supplyChainId } = useAuth();

  return useQuery({
    queryKey: ['activity-log', supplyChainId],
    queryFn: async () => {
      const [{ data: rows, error: rowsError }, { data: users, error: usersError }] = await Promise.all([
        supabase
          .from('activity_log')
          .select('*')
          .order('updated_at', { ascending: false }),
        supabase.rpc('get_supply_chain_usernames'),
      ]);
      if (rowsError) throw rowsError;
      if (usersError) throw usersError;

      const nameById = new Map((users || []).map((u) => [u.id, u.username]));
      return (rows || []).map((row) => ({
        ...row,
        created_by_name: row.created_by ? (nameById.get(row.created_by) || null) : null,
        updated_by_name: row.updated_by ? (nameById.get(row.updated_by) || null) : null,
      }));
    },
    enabled: !!supplyChainId,
  });
}
