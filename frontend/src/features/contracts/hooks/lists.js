import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

// Real bug found via independent audit (BUG-36): the Dashboard's Year
// filter offered a hardcoded ['2026', '2025', '2024'] list, while real
// 2027 contracts already existed and were completely invisible to it.
// Derives the real, current set of years directly from the data
// instead of a list that goes stale the moment a new year of contracts
// exists.
export function useContractYears() {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['contract-years', supplyChainId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('year')
        .eq('supply_chain_id', supplyChainId);
      if (error) throw error;
      return [...new Set((data || []).map((r) => r.year))].sort((a, b) => b - a);
    },
    enabled: !!supplyChainId,
  });
}

export function useContracts({ page = 1, pageSize = 5, search = '', year = '', standard = '', contractType = '', country = '' } = {}) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['contracts', { page, pageSize, search, year, standard, contractType, country, supplyChainId }],
    queryFn: async () => {
      // Query the contract_groups view (one row per real contract, line
      // items aggregated) rather than the raw contracts table, which is
      // one row per product line and would otherwise show a multi-product
      // contract as several separate rows.
      let query = supabase
        .from('contract_groups')
        .select('*, actors(traceability_code, contact_name)', { count: 'exact' })
        .eq('supply_chain_id', supplyChainId)
        .order('created_at', { ascending: false });

      if (year) query = query.eq('year', year);
      if (standard) query = query.eq('standard', standard);
      if (contractType) query = query.eq('contract_type', contractType);
      if (country) query = query.eq('country', country);

      // CRITICAL fix (BUG-03, independent audit): this used to fetch one
      // page's worth of rows first (.range() already applied), THEN
      // filter that small, already-limited subset client-side -- so a
      // real match sitting on any OTHER page returned nothing at all,
      // indistinguishable from search being completely broken. Moved to
      // a real, server-side filter applied before .range(). Matches by
      // supplier name via a reliable two-step actor lookup rather than
      // PostgREST's embedded-resource dot-notation filtering (uncertain
      // through the JS client for a joined/embedded table), plus a
      // direct match on the contract's own code.
      if (search) {
        const { data: matchingActors } = await supabase
          .from('actors')
          .select('id')
          .eq('supply_chain_id', supplyChainId)
          .or(`contact_name.ilike.%${search}%,traceability_code.ilike.%${search}%`);
        const actorIds = (matchingActors || []).map((a) => a.id);
        const orParts = [`contract_code.ilike.%${search}%`];
        if (actorIds.length > 0) orParts.push(`actor_id.in.(${actorIds.join(',')})`);
        query = query.or(orParts.join(','));
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      return { rows: data, total: count };
    },
    enabled: !!supplyChainId,
    staleTime: 30_000,
  });
}

// Contract fulfillment tracking: the "Link to contract" dropdown on
// Send/Receive needs the raw per-product-line contracts table (one row
// per product), not the aggregated contract_groups view -- linking has
// to point at a specific line's own id and expected_quantity, not a
// whole multi-product contract. RLS already scopes this to the current
// actor's own contracts; no extra owner filter needed here.
//
// Filters by destination actor (actorId), not product -- confirmed as
// the right choice after real feedback flagged the earlier "no
// filtering at all" version as unsafe (could link a Honey shipment to
// a Beeswax contract for a totally different buyer with zero warning).
// Filtering by actor alone, not also product, matches how contracts
// actually work here: one contract can cover multiple products, so a
// strict double-match on both fields could hide the very contract line
// you want. Direction (Send transactions only see Send-type contracts)
// is still a baseline correctness constraint, not optional filtering.
export function useContractsForLinking(contractType, actorId) {
  const { supplyChainId, profile } = useAuth();
  const myActorId = profile?.current_actor_id;
  return useQuery({
    queryKey: ['contracts-for-linking', contractType, actorId, myActorId, supplyChainId],
    queryFn: async () => {
      let query = supabase
        .from('contracts')
        .select('id, contract_code, product, expected_quantity, unit')
        .eq('supply_chain_id', supplyChainId)
        .eq('contract_type', contractType)
        .order('created_at', { ascending: false });
      // Real gap found via direct feedback: a contract has two actor
      // references -- owning_actor_id (who created it) and actor_id
      // (the counterparty). The previous version only checked
      // actor_id = the buyer, which correctly caught the case where I
      // created the contract and named them as counterparty, but
      // completely missed the reverse: a contract THEY created,
      // naming ME as counterparty, is just as real a "contract I have
      // with this buyer" -- just from the other direction. Now checks
      // both directions explicitly, so this shows contracts between me
      // and this specific buyer regardless of who actually created it,
      // not contracts that merely happen to reference the buyer's id
      // in one particular field.
      if (actorId && myActorId) {
        query = query.or(
          `and(owning_actor_id.eq.${myActorId},actor_id.eq.${actorId}),and(owning_actor_id.eq.${actorId},actor_id.eq.${myActorId})`
        );
      }
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!supplyChainId && !!contractType && !!actorId && !!myActorId,
  });
}
