import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

// States/LGAs now live in the `regions` table (country, level, name,
// parent_name) instead of being hardcoded in frontend code — see
// migration `create_regions_table` / `seed_regions_data`. This means
// corrections/additions (e.g. populating Ghana's districts later) can be
// made directly in Supabase without a code deploy.

export function useStatesForCountry(country) {
  return useQuery({
    queryKey: ['regions', 'states', country],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regions')
        .select('name')
        .eq('country', country)
        .eq('level', 'state')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data.map((r) => r.name);
    },
    enabled: !!country,
    staleTime: 60 * 60_000, // reference data, safe to cache for an hour
  });
}

export function useLgasForState(country, state) {
  return useQuery({
    queryKey: ['regions', 'lgas', country, state],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('regions')
        .select('name')
        .eq('country', country)
        .eq('level', 'lga')
        .eq('parent_name', state)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      return data.map((r) => r.name);
    },
    enabled: !!country && !!state,
    staleTime: 60 * 60_000,
  });
}
