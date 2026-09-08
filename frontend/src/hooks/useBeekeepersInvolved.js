import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const BROWN = 'Beeswax-Brown';
const YELLOW = 'Beeswax-Yellow';
const CRUDE_WAX = 'Crude Wax';
// Real, deliberate mapping choice, documented rather than silently
// assumed: this app's real product list has no exact "gâteau miel"
// (honeycomb) match. Mapped to both Honey and Crude Honey together --
// honeycomb is functionally a raw/crude honey product, and there's no
// way to pick just one without more information from the source.
const HONEY_PRODUCTS = ['Honey', 'Crude Honey'];

// Builds the Indicators page's "Apiculteurs impliqués" (Beekeepers
// Involved) section basics, confirmed via a real screenshot of the
// source dashboard (previously marked "Not started" in the original
// text handoff document, with no real spec to build from at all).
//
// "Involved" (impliqué) is defined here the same way "Achieved" was
// defined for actors on the Season page: a beekeeper who actually
// delivered that specific product type in the selected year, not
// just a beekeeper who exists in the system.
export function useBeekeepersInvolved({ year }) {
  const { supplyChainId } = useAuth();
  const prevYear = year ? Number(year) - 1 : null;

  return useQuery({
    queryKey: ['beekeepers-involved', supplyChainId, year],
    queryFn: async () => {
      const [beekeepers, thisYearTx, lastYearTx] = await Promise.all([
        supabase.from('beekeepers').select('id, gender, year_of_birth, charter_signed')
          .eq('supply_chain_id', supplyChainId),
        supabase.from('transactions').select('beekeeper_id, product')
          .eq('supply_chain_id', supplyChainId).eq('direction', 'Received').not('beekeeper_id', 'is', null)
          .gte('transaction_date', `${year}-01-01`).lte('transaction_date', `${year}-12-31`),
        supabase.from('transactions').select('beekeeper_id, product')
          .eq('supply_chain_id', supplyChainId).eq('direction', 'Received').not('beekeeper_id', 'is', null)
          .gte('transaction_date', `${prevYear}-01-01`).lte('transaction_date', `${prevYear}-12-31`),
      ]);
      if (beekeepers.error) throw beekeepers.error;
      if (thisYearTx.error) throw thisYearTx.error;
      if (lastYearTx.error) throw lastYearTx.error;

      const involvedIn = (rows, productFilter) => {
        const ids = new Set();
        rows.forEach((t) => {
          if (!productFilter || productFilter(t.product)) ids.add(t.beekeeper_id);
        });
        return ids;
      };

      const thisWax = involvedIn(thisYearTx.data, (p) => p === BROWN || p === YELLOW || p === CRUDE_WAX);
      const thisYellow = involvedIn(thisYearTx.data, (p) => p === YELLOW);
      const thisBrown = involvedIn(thisYearTx.data, (p) => p === BROWN);
      const thisCrude = involvedIn(thisYearTx.data, (p) => p === CRUDE_WAX);
      const thisHoney = involvedIn(thisYearTx.data, (p) => HONEY_PRODUCTS.includes(p));
      const thisTotal = involvedIn(thisYearTx.data);

      const lastWax = involvedIn(lastYearTx.data, (p) => p === BROWN || p === YELLOW || p === CRUDE_WAX);
      const lastYellow = involvedIn(lastYearTx.data, (p) => p === YELLOW);
      const lastBrown = involvedIn(lastYearTx.data, (p) => p === BROWN);
      const lastCrude = involvedIn(lastYearTx.data, (p) => p === CRUDE_WAX);
      const lastHoney = involvedIn(lastYearTx.data, (p) => HONEY_PRODUCTS.includes(p));
      const lastTotal = involvedIn(lastYearTx.data);

      const involvedBeekeepers = beekeepers.data.filter((b) => thisTotal.has(b.id));
      const currentYearNum = year ? Number(year) : new Date().getFullYear();

      const genderCounts = { Male: 0, Female: 0, Other: 0 };
      let youthCount = 0;
      let charterSignedCount = 0;
      involvedBeekeepers.forEach((b) => {
        if (genderCounts[b.gender] != null) genderCounts[b.gender] += 1;
        if (b.year_of_birth && (currentYearNum - b.year_of_birth) >= 18 && (currentYearNum - b.year_of_birth) <= 25) youthCount += 1;
        if (b.charter_signed) charterSignedCount += 1;
      });

      const delta = (thisSet, lastSet) => ({ count: thisSet.size, delta: thisSet.size - lastSet.size });

      return {
        total: delta(thisTotal, lastTotal),
        wax: delta(thisWax, lastWax),
        yellow: delta(thisYellow, lastYellow),
        brown: delta(thisBrown, lastBrown),
        crude: delta(thisCrude, lastCrude),
        honey: delta(thisHoney, lastHoney),
        involvedCount: involvedBeekeepers.length,
        genderCounts,
        youthCount,
        youthRatio: involvedBeekeepers.length > 0 ? youthCount / involvedBeekeepers.length : 0,
        charterSignedCount,
        charterSignedRatio: involvedBeekeepers.length > 0 ? charterSignedCount / involvedBeekeepers.length : 0,
      };
    },
    enabled: !!supplyChainId && !!year,
    staleTime: 30_000,
  });
}
