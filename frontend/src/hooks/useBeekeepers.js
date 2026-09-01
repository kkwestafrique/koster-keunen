import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

export function useBeekeepers({
  page = 1,
  pageSize = 5,
  search = '',
  gender = '',
  villageId = '',
  status = '',
  year = '',
} = {}) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['beekeepers', { page, pageSize, search, gender, villageId, status, year, supplyChainId }],
    queryFn: async () => {
      let query = supabase
        .from('beekeepers')
        .select('*, villages(name), actors!beekeepers_actor_id_fkey(contact_name, traceability_code)', { count: 'exact' })
        .eq('supply_chain_id', supplyChainId)
        // Orphan beekeepers (actor_id IS NULL, e.g. imported before an actor
        // link was assigned) must never surface in a per-actor scoped list —
        // confirmed leaking into every Admin actor context (bug found in
        // iteration_4.json testing pass). They're not this actor's data, so
        // exclude them explicitly rather than relying on RLS alone.
        .not('actor_id', 'is', null)
        .order('created_at', { ascending: false });

      if (search) {
        query = query.or(`traceability_code.ilike.%${search}%,full_name.ilike.%${search}%`);
      }
      if (gender) query = query.eq('gender', gender);
      if (villageId) query = query.eq('village_id', villageId);
      if (status) query = query.eq('status', status);
      // beekeepers has no `year` column — "year" here means the year the
      // record was added, same convention used by the Report page.
      if (year) query = query.gte('created_at', `${year}-01-01`).lte('created_at', `${year}-12-31T23:59:59`);

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;
      if (error) throw error;

      // "Active years" previously showed a static, disconnected stored
      // integer (beekeepers.active_years) that had no real relationship
      // to actual activity. This computes the real last year a beekeeper
      // made a transaction, scoped to just the current page's IDs (cheap,
      // not a full-table scan) rather than touching the old column at
      // all.
      const ids = (data || []).map((b) => b.id);
      let lastActiveYearById = {};
      if (ids.length > 0) {
        const { data: txRows, error: txError } = await supabase
          .from('transactions')
          .select('beekeeper_id, transaction_date')
          .in('beekeeper_id', ids);
        if (txError) throw txError;
        (txRows || []).forEach((t) => {
          if (!t.transaction_date) return;
          const yr = new Date(t.transaction_date).getFullYear();
          if (!lastActiveYearById[t.beekeeper_id] || yr > lastActiveYearById[t.beekeeper_id]) {
            lastActiveYearById[t.beekeeper_id] = yr;
          }
        });
      }
      const rows = (data || []).map((b) => ({ ...b, last_active_year: lastActiveYearById[b.id] || null }));

      return { rows, total: count };
    },
    enabled: !!supplyChainId,
    staleTime: 30_000,
  });
}

export function useBeekeeper(id) {
  return useQuery({
    queryKey: ['beekeeper', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('beekeepers')
        .select('*, villages(name, country, state_region, lga_municipality), actors!beekeepers_actor_id_fkey(contact_name, traceability_code), linked_producer_organisation_actor:actors!linked_producer_organisation_id(id, contact_name)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
    // Same fix as useStock/useActor (BUG-43): a record genuinely not
    // accessible fails the exact same way every retry, so the default
    // retry behavior only delays reaching the same, accurate result.
    retry: false,
  });
}

export function useCreateBeekeeper() {
  const { supplyChainId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload) => {
      const { data, error } = await supabase
        .from('beekeepers')
        .insert([{ ...payload, supply_chain_id: supplyChainId }])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['beekeepers'] });
    },
  });
}

// Gap 21: dashboard metrics had no written, tested definition anywhere --
// exactly the kind of gap that let the real platform's dashboard show two
// contradictory beekeeper counts on the same screen without anyone
// noticing. This is the definition for every number this hook produces;
// see src/hooks/__tests__/dashboardMetrics.test.js for the test that
// verifies the actual behavior matches it.
//
// DEFINITION (v1):
//   total          = count of DISTINCT beekeeper records in this supply
//                    chain (optionally filtered to one country via their
//                    village). One beekeeper = one unit, regardless of
//                    how many transactions they have -- this is the exact
//                    distinction the real platform's own audit found
//                    broken (their equivalent metric silently counted
//                    TRANSACTIONS, showing ~12,000 against a real total of
//                    534 people).
//   male/female/genderOther = count of beekeepers whose gender field
//                    exactly matches that value. These three MUST always
//                    sum to `total` -- if they don't, some beekeeper has a
//                    gender value outside the three enum options, which
//                    the test explicitly checks for.
//   traditional/modern/other = SUM of hive counts (not beekeeper counts)
//                    across the relevant hive-type columns. These are
//                    physical hive totals, not people -- deliberately a
//                    different kind of number from the counts above, and
//                    should never be compared directly against `total`.
// Pure function, deliberately separated from the network/query concerns
// above it so it can be unit-tested directly with plain JS objects -- see
// src/hooks/__tests__/dashboardMetrics.test.js.
export function aggregateBeekeepers(rows) {
  const agg = {
    total: rows.length,
    male: 0,
    female: 0,
    genderOther: 0,
    traditional: 0,
    modern: 0,
    other: 0,
  };
  rows.forEach((row) => {
    if (row.gender === 'Male') agg.male += 1;
    else if (row.gender === 'Female') agg.female += 1;
    else if (row.gender === 'Other') agg.genderOther += 1;
    agg.traditional += (row.hives_traditional_single || 0) + (row.hives_traditional_double || 0);
    agg.modern += row.hives_modern || 0;
    agg.other += row.hives_other || 0;
  });
  return agg;
}

export function useBeekeeperAggregates({ country = '' } = {}) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['beekeeper-aggregates', supplyChainId, country],
    queryFn: async () => {
      let query = supabase
        .from('beekeepers')
        .select(
          country
            ? 'gender, hives_traditional_single, hives_traditional_double, hives_modern, hives_other, villages!inner(country)'
            : 'gender, hives_traditional_single, hives_traditional_double, hives_modern, hives_other'
        )
        .eq('supply_chain_id', supplyChainId)
        // Real bug found via independent audit: "beekeeper count
        // disagreement across dashboard/list/export". Confirmed
        // directly against live data (11 total, 1 with no owning actor
        // at all) -- the List query already correctly excludes these
        // orphaned records, but this Dashboard count never did, so an
        // Admin account (the only role able to see actor_id-null rows
        // at all, per RLS) would see a different, inflated total here
        // than on the List. Matched to the List's already-correct
        // behavior rather than the other way around, since a beekeeper
        // record with no owning actor isn't a complete, real one.
        .not('actor_id', 'is', null);
      if (country) query = query.eq('villages.country', country);
      const { data, error } = await query;
      if (error) throw error;
      return aggregateBeekeepers(data);
    },
    enabled: !!supplyChainId,
    staleTime: 30_000,
  });
}

export function useUpdateBeekeeper() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }) => {
      const { data, error } = await supabase
        .from('beekeepers')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['beekeepers'] });
      queryClient.invalidateQueries({ queryKey: ['beekeeper', data.id] });
      // Editing hive/commitment/charter fields re-syncs the current year's
      // row via the sync_beekeeper_current_year_record DB trigger, so the
      // Overview tab's history needs to refetch too.
      queryClient.invalidateQueries({ queryKey: ['beekeeper-yearly-records', data.id] });
    },
  });
}

// Overview tab's "Previous year details" — one row per calendar year,
// newest first, kept in sync automatically by a DB trigger whenever the
// beekeeper's hive/commitment/charter fields are written (see migration
// beekeeper_description_and_yearly_records).
export function useBeekeeperYearlyRecords(beekeeperId) {
  return useQuery({
    queryKey: ['beekeeper-yearly-records', beekeeperId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('beekeeper_yearly_records')
        .select('*')
        .eq('beekeeper_id', beekeeperId)
        .order('year', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!beekeeperId,
  });
}
