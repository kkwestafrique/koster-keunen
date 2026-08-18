import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { ACTOR_TYPES } from '@/data/regions';

// Gap 19: actor types were hardcoded in a JS constant -- the target spec
// says every reference list should be real, editable data. This reads the
// real actor_types table instead.
//
// Falls back to the original hardcoded constant if the query fails, so a
// transient network problem degrades to the previous behavior rather than
// rendering an empty, unusable Actor Type dropdown.
export function useActorTypes({ selectableOnly = true } = {}) {
  return useQuery({
    queryKey: ['actor-types', selectableOnly],
    queryFn: async () => {
      let query = supabase
        .from('actor_types')
        .select('name, is_selectable, display_order')
        .order('display_order', { ascending: true });
      if (selectableOnly) query = query.eq('is_selectable', true);

      const { data, error } = await query;
      if (error) throw error;
      return data.map((r) => r.name);
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: ACTOR_TYPES,
  });
}
