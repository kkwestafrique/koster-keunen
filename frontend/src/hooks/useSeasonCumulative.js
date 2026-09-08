import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const BROWN = 'Beeswax-Brown';
const YELLOW = 'Beeswax-Yellow';

// Builds the Season page's cumulative % contract-fulfillment chart
// (section 5.5 of the Power BI handoff document): for each month,
// what % of the FULL year's contract had been received by that point,
// cumulatively -- for this year and last year, so progress can be
// compared side by side on the same month axis.
//
// Extended to real Marron- and Jaune-specific series here, matching
// the same pattern as the already-built Total series, even though the
// source document's own text only explicitly relists Jaune alongside
// Total -- Marron follows the identical pattern and there's no real
// reason to leave it out of an otherwise-complete implementation.
export function useSeasonCumulative({ year }) {
  const { supplyChainId } = useAuth();
  const prevYear = year ? Number(year) - 1 : null;

  return useQuery({
    queryKey: ['season-cumulative', supplyChainId, year],
    queryFn: async () => {
      const [thisYearTx, lastYearTx, contracts] = await Promise.all([
        supabase.from('transactions').select('product, quantity, transaction_date')
          .eq('supply_chain_id', supplyChainId).eq('direction', 'Received')
          .gte('transaction_date', `${year}-01-01`).lte('transaction_date', `${year}-12-31`),
        supabase.from('transactions').select('product, quantity, transaction_date')
          .eq('supply_chain_id', supplyChainId).eq('direction', 'Received')
          .gte('transaction_date', `${prevYear}-01-01`).lte('transaction_date', `${prevYear}-12-31`),
        supabase.from('contracts').select('product, expected_quantity, year').eq('supply_chain_id', supplyChainId),
      ]);
      if (thisYearTx.error) throw thisYearTx.error;
      if (lastYearTx.error) throw lastYearTx.error;
      if (contracts.error) throw contracts.error;

      const contractTotalFor = (yr, product) => contracts.data
        .filter((c) => c.year === yr && (!product || c.product === product))
        .reduce((sum, c) => sum + (Number(c.expected_quantity) || 0), 0);

      const contractThisTotal = contractTotalFor(Number(year));
      const contractThisMarron = contractTotalFor(Number(year), BROWN);
      const contractThisJaune = contractTotalFor(Number(year), YELLOW);
      const contractLastTotal = contractTotalFor(prevYear);
      const contractLastMarron = contractTotalFor(prevYear, BROWN);
      const contractLastJaune = contractTotalFor(prevYear, YELLOW);

      const cumulativeQtyThroughMonth = (rows, monthNum, product) => rows
        .filter((r) => (!product || r.product === product) && new Date(r.transaction_date).getMonth() + 1 <= monthNum)
        .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

      const pct = (qty, contractTotal) => (contractTotal > 0 ? qty / contractTotal : 0);

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return months.map((label, i) => {
        const m = i + 1;
        return {
          month: label,
          thisYearTotal: pct(cumulativeQtyThroughMonth(thisYearTx.data, m), contractThisTotal),
          lastYearTotal: pct(cumulativeQtyThroughMonth(lastYearTx.data, m), contractLastTotal),
          thisYearMarron: pct(cumulativeQtyThroughMonth(thisYearTx.data, m, BROWN), contractThisMarron),
          lastYearMarron: pct(cumulativeQtyThroughMonth(lastYearTx.data, m, BROWN), contractLastMarron),
          thisYearJaune: pct(cumulativeQtyThroughMonth(thisYearTx.data, m, YELLOW), contractThisJaune),
          lastYearJaune: pct(cumulativeQtyThroughMonth(lastYearTx.data, m, YELLOW), contractLastJaune),
        };
      });
    },
    enabled: !!supplyChainId && !!year,
    staleTime: 30_000,
  });
}
