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
        .select('*, villages(name), actors(contact_name, traceability_code)', { count: 'exact' })
        .eq('supply_chain_id', supplyChainId)
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
      return { rows: data, total: count };
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
        .select('*, villages(name, country, state_region, lga_municipality), actors(contact_name, traceability_code)')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
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
        .eq('supply_chain_id', supplyChainId);
      if (country) query = query.eq('villages.country', country);
      const { data, error } = await query;
      if (error) throw error;
      const agg = {
        total: data.length,
        male: 0,
        female: 0,
        traditional: 0,
        modern: 0,
        other: 0,
      };
      data.forEach((row) => {
        if (row.gender === 'Male') agg.male += 1;
        if (row.gender === 'Female') agg.female += 1;
        agg.traditional += (row.hives_traditional_single || 0) + (row.hives_traditional_double || 0);
        agg.modern += row.hives_modern || 0;
        agg.other += row.hives_other || 0;
      });
      return agg;
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
