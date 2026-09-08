import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const BROWN = 'Beeswax-Brown';
const YELLOW = 'Beeswax-Yellow';
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function sumByProduct(rows, product, field) {
  return rows.filter((r) => !product || r.product === product).reduce((sum, r) => sum + (Number(r[field]) || 0), 0);
}

// Builds the Season page's 5.4 (monthly combo chart) and 5.5
// (cumulative charts) from the Power BI handoff document, sharing one
// query since both are really the same underlying per-month
// breakdown -- 5.5 is just a running total of 5.4.
//
// Real bug already found and fixed once in the source document's own
// version: a text-vs-number comparison bug in the cumulative measure's
// month filter. Not a risk here at all -- built directly from real
// JS numbers throughout, not a text-typed month column.
export function useSeasonMonthly({ year }) {
  const { supplyChainId } = useAuth();
  const prevYear = year ? Number(year) - 1 : null;

  return useQuery({
    queryKey: ['season-monthly', supplyChainId, year],
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

      const contractTotalFor = (yr, product) => sumByProduct(
        contracts.data.filter((c) => c.year === yr), product, 'expected_quantity'
      );

      const buildSeries = (product) => {
        const contractThis = contractTotalFor(Number(year), product);
        const contractLast = contractTotalFor(prevYear, product);

        const qtyByMonth = (rows) => {
          const byMonth = Array(12).fill(0);
          rows.filter((r) => !product || r.product === product).forEach((r) => {
            const m = new Date(r.transaction_date).getMonth();
            byMonth[m] += Number(r.quantity) || 0;
          });
          return byMonth;
        };

        const thisMonthly = qtyByMonth(thisYearTx.data);
        const lastMonthly = qtyByMonth(lastYearTx.data);

        let cumThis = 0, cumLast = 0;
        return MONTH_NAMES.map((label, i) => {
          cumThis += thisMonthly[i];
          cumLast += lastMonthly[i];
          return {
            month: label,
            pctThisYear: contractThis > 0 ? thisMonthly[i] / contractThis : 0,
            pctPrevYear: contractLast > 0 ? lastMonthly[i] / contractLast : 0,
            cumPctThisYear: contractThis > 0 ? cumThis / contractThis : 0,
            cumPctPrevYear: contractLast > 0 ? cumLast / contractLast : 0,
          };
        });
      };

      return {
        total: buildSeries(null),
        marron: buildSeries(BROWN),
        jaune: buildSeries(YELLOW),
      };
    },
    enabled: !!supplyChainId && !!year,
    staleTime: 30_000,
  });
}
