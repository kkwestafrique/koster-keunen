import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

async function fetchConstants(category) {
  const { data, error } = await supabase
    .from('constants')
    .select('*')
    .eq('category', category)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
}

export function useConstants(category) {
  return useQuery({
    queryKey: ['constants', category],
    queryFn: () => fetchConstants(category),
    staleTime: 30_000,
  });
}
