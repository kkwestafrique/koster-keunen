import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

// Real, deliberate mapping choice: this app has no separate
// "Groupement" concept. Mapped to linked_producer_organisation_id --
// the real field tracking which Producer Organisation a beekeeper is
// affiliated with, matching "Groupement"'s real meaning (a farmer
// group/cooperative) in this domain.
export function useBeekeepersTrends({ year }) {
  const { supplyChainId } = useAuth();
  const prevYear = year ? Number(year) - 1 : null;

  return useQuery({
    queryKey: ['beekeepers-trends', supplyChainId, year],
    queryFn: async () => {
      const [beekeepers, thisYearTx, lastYearTx, allTx] = await Promise.all([
        supabase.from('beekeepers').select('id, village_id, linked_producer_organisation_id, gender, hives_traditional_single, hives_traditional_double, hives_modern, hives_other')
          .eq('supply_chain_id', supplyChainId),
        supabase.from('transactions').select('beekeeper_id')
          .eq('supply_chain_id', supplyChainId).eq('direction', 'Received').not('beekeeper_id', 'is', null)
          .gte('transaction_date', `${year}-01-01`).lte('transaction_date', `${year}-12-31`),
        supabase.from('transactions').select('beekeeper_id')
          .eq('supply_chain_id', supplyChainId).eq('direction', 'Received').not('beekeeper_id', 'is', null)
          .gte('transaction_date', `${prevYear}-01-01`).lte('transaction_date', `${prevYear}-12-31`),
        // For the 6-year trend -- fetched once across all years, not
        // one query per year, to keep this to a real, bounded number
        // of requests regardless of how many years of history exist.
        supabase.from('transactions').select('beekeeper_id, transaction_date')
          .eq('supply_chain_id', supplyChainId).eq('direction', 'Received').not('beekeeper_id', 'is', null),
      ]);
      if (beekeepers.error) throw beekeepers.error;
      if (thisYearTx.error) throw thisYearTx.error;
      if (lastYearTx.error) throw lastYearTx.error;
      if (allTx.error) throw allTx.error;

      const byId = {};
      beekeepers.data.forEach((b) => { byId[b.id] = b; });

      const involvedThisYear = new Set(thisYearTx.data.map((t) => t.beekeeper_id));
      const involvedLastYear = new Set(lastYearTx.data.map((t) => t.beekeeper_id));

      const villagesThisYear = new Set();
      const groupementsThisYear = new Set();
      let hivesTraditional1 = 0, hivesTraditional2 = 0, hivesModern = 0, hivesOther = 0;
      involvedThisYear.forEach((id) => {
        const b = byId[id];
        if (!b) return;
        if (b.village_id) villagesThisYear.add(b.village_id);
        if (b.linked_producer_organisation_id) groupementsThisYear.add(b.linked_producer_organisation_id);
        hivesTraditional1 += Number(b.hives_traditional_single) || 0;
        hivesTraditional2 += Number(b.hives_traditional_double) || 0;
        hivesModern += Number(b.hives_modern) || 0;
        hivesOther += Number(b.hives_other) || 0;
      });

      const villagesLastYear = new Set();
      const groupementsLastYear = new Set();
      involvedLastYear.forEach((id) => {
        const b = byId[id];
        if (!b) return;
        if (b.village_id) villagesLastYear.add(b.village_id);
        if (b.linked_producer_organisation_id) groupementsLastYear.add(b.linked_producer_organisation_id);
      });

      // 6-year Hommes/Femmes trend: distinct involved beekeepers each
      // year, split by gender, for the most recent 6 real years of
      // data -- deliberately independent of the page's own Year
      // filter, matching the same pattern used for the Season page's
      // yearly trend chart.
      const yearsWithData = new Set(allTx.data.map((t) => new Date(t.transaction_date).getFullYear()));
      const last6Years = Array.from(yearsWithData).sort((a, b) => b - a).slice(0, 6).sort((a, b) => a - b);
      const genderTrend = last6Years.map((yr) => {
        const involvedIds = new Set(
          allTx.data.filter((t) => new Date(t.transaction_date).getFullYear() === yr).map((t) => t.beekeeper_id)
        );
        let men = 0, women = 0;
        involvedIds.forEach((id) => {
          const b = byId[id];
          if (b?.gender === 'Male') men += 1;
          else if (b?.gender === 'Female') women += 1;
        });
        return { year: String(yr), men, women };
      });

      return {
        villages: { count: villagesThisYear.size, delta: villagesThisYear.size - villagesLastYear.size },
        groupements: { count: groupementsThisYear.size, delta: groupementsThisYear.size - groupementsLastYear.size },
        hives: {
          traditional1: hivesTraditional1,
          traditional2: hivesTraditional2,
          modern: hivesModern,
          other: hivesOther,
          total: hivesTraditional1 + hivesTraditional2 + hivesModern + hivesOther,
        },
        genderTrend,
      };
    },
    enabled: !!supplyChainId && !!year,
    staleTime: 30_000,
  });
}
