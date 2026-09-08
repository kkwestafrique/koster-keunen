import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

export function useExchangeRates() {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['exchange-rates', supplyChainId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('exchange_rates')
        .select('*')
        .eq('supply_chain_id', supplyChainId)
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .order('currency', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: !!supplyChainId,
    staleTime: 60_000,
  });
}

export function useUpsertExchangeRate() {
  const { supplyChainId, profile } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ currency, year, month, rate_to_xof }) => {
      const { error } = await supabase
        .from('exchange_rates')
        .upsert(
          { supply_chain_id: supplyChainId, currency, year, month, rate_to_xof, created_by: profile?.id, updated_at: new Date().toISOString() },
          { onConflict: 'supply_chain_id,currency,year,month' }
        );
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exchange-rates', supplyChainId] }),
  });
}

export function useDeleteExchangeRate() {
  const { supplyChainId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => {
      const { error } = await supabase.from('exchange_rates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['exchange-rates', supplyChainId] }),
  });
}
