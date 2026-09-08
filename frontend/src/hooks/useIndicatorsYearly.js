import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const YELLOW = 'Beeswax-Yellow';

function sumField(rows, field) {
  return rows.reduce((sum, r) => sum + (Number(r[field]) || 0), 0);
}

// Builds the Indicators page's yearly Quantité/Contrat/Qualité combo
// chart from the Power BI handoff document -- deliberately detached
// from the page's own Year filter (the source uses "Edit interactions
// -> None" from its Year slicer to this specific chart), always
// showing the most recent 6 years of real data regardless of what
// year is selected elsewhere on the page.
export function useIndicatorsYearly() {
  const { supplyChainId } = useAuth();

  return useQuery({
    queryKey: ['indicators-yearly', supplyChainId],
    queryFn: async () => {
      const [received, contracts] = await Promise.all([
        supabase.from('transactions').select('product, quantity, transaction_date')
          .eq('supply_chain_id', supplyChainId).eq('direction', 'Received'),
        supabase.from('contracts').select('product, expected_quantity, year').eq('supply_chain_id', supplyChainId),
      ]);
      if (received.error) throw received.error;
      if (contracts.error) throw contracts.error;

      const years = new Set();
      received.data.forEach((r) => years.add(new Date(r.transaction_date).getFullYear()));
      contracts.data.forEach((c) => years.add(c.year));
      const last6 = Array.from(years).filter((y) => y).sort((a, b) => b - a).slice(0, 6).sort((a, b) => a - b);

      return last6.map((yr) => {
        const receivedThisYear = received.data.filter((r) => new Date(r.transaction_date).getFullYear() === yr);
        const contractsThisYear = contracts.data.filter((c) => c.year === yr);
        const qty = sumField(receivedThisYear, 'quantity');
        const qtyYellow = sumField(receivedThisYear.filter((r) => r.product === YELLOW), 'quantity');
        const contract = sumField(contractsThisYear, 'expected_quantity');
        return {
          year: String(yr),
          qty,
          contract,
          qualite: qty > 0 ? qtyYellow / qty : 0,
        };
      });
    },
    enabled: !!supplyChainId,
    staleTime: 30_000,
  });
}
