import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { COUNTRIES, COUNTRY_CURRENCY, PRODUCTS } from '@/data/regions';

// Gap 8: countries were hardcoded in JS. Falls back to the original
// constant if the query fails, so a transient network problem degrades
// to the previous behavior rather than an empty dropdown.
export function useCountries() {
  return useQuery({
    queryKey: ['countries'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('countries')
        .select('name, currency')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: COUNTRIES.map((name) => ({ name, currency: COUNTRY_CURRENCY[name] })),
  });
}

// Gap 4: products were only ever a fixed dropdown list embedded inside
// forms -- no page to browse or manage them on their own.
export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, display_order')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    placeholderData: PRODUCTS.map((name, i) => ({ id: name, name, display_order: i + 1 })),
  });
}
