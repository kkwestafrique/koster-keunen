import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const YELLOW = 'Beeswax-Yellow';

function sumField(rows, field) {
  return rows.reduce((sum, r) => sum + (Number(r[field]) || 0), 0);
}

// Builds the first part of the Indicators page's 6.1 "Quantity &
// Quality" section from the Power BI handoff document: the Standard
// split donut, Total Beeswax card (with year-over-year), Yellow
// Beeswax card (with year-over-year), and the country ratio table.
//
// The Standard donut is documented in the source as deliberately
// ignoring any Standard filter while still respecting Year -- true
// here by construction, since this page has no Standard filter of its
// own yet to ignore.
export function useIndicatorsQuality({ year }) {
  const { supplyChainId } = useAuth();
  const prevYear = year ? Number(year) - 1 : null;

  return useQuery({
    queryKey: ['indicators-quality', supplyChainId, year],
    queryFn: async () => {
      const [thisYear, lastYear] = await Promise.all([
        supabase.from('transactions').select('product, quantity, standard, actors(country)')
          .eq('supply_chain_id', supplyChainId).eq('direction', 'Received')
          .gte('transaction_date', `${year}-01-01`).lte('transaction_date', `${year}-12-31`),
        supabase.from('transactions').select('quantity, product')
          .eq('supply_chain_id', supplyChainId).eq('direction', 'Received')
          .gte('transaction_date', `${prevYear}-01-01`).lte('transaction_date', `${prevYear}-12-31`),
      ]);
      if (thisYear.error) throw thisYear.error;
      if (lastYear.error) throw lastYear.error;

      const rows = thisYear.data;
      const totalBeeswax = sumField(rows, 'quantity');
      const totalYellow = sumField(rows.filter((r) => r.product === YELLOW), 'quantity');
      const lastYearTotal = sumField(lastYear.data, 'quantity');
      const lastYearYellow = sumField(lastYear.data.filter((r) => r.product === YELLOW), 'quantity');
      const yoy = (thisVal, lastVal) => (lastVal > 0 ? (thisVal - lastVal) / lastVal : 0);

      const byStandard = {};
      rows.forEach((r) => {
        if (!r.standard) return;
        byStandard[r.standard] = (byStandard[r.standard] || 0) + (Number(r.quantity) || 0);
      });

      const byCountry = {};
      rows.forEach((r) => {
        const country = r.actors?.country;
        if (!country) return;
        if (!byCountry[country]) byCountry[country] = { total: 0, yellow: 0 };
        byCountry[country].total += Number(r.quantity) || 0;
        if (r.product === YELLOW) byCountry[country].yellow += Number(r.quantity) || 0;
      });
      const countryTable = Object.entries(byCountry)
        .map(([country, v]) => ({ country, total: v.total, yellow: v.yellow, ratio: v.total > 0 ? v.yellow / v.total : 0 }))
        .sort((a, b) => b.yellow - a.yellow);

      return {
        totalBeeswax,
        totalBeeswaxYoy: yoy(totalBeeswax, lastYearTotal),
        totalYellow,
        yellowRatio: totalBeeswax > 0 ? totalYellow / totalBeeswax : 0,
        yellowYoy: yoy(totalYellow, lastYearYellow),
        byStandard,
        countryTable,
      };
    },
    enabled: !!supplyChainId && !!year,
    staleTime: 30_000,
  });
}
