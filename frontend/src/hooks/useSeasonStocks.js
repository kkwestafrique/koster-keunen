import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const BROWN = 'Beeswax-Brown';
const YELLOW = 'Beeswax-Yellow';
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function sumBy(rows, key, value, field) {
  return rows.filter((r) => r[key] === value).reduce((sum, r) => sum + (Number(r[field]) || 0), 0);
}

// Builds section 5.6 from the Power BI handoff document: Stock Raw
// Material, Loss rate, Stock Final Products (all cumulative all-time,
// respecting Standard but ignoring Year, matching the source's own
// confirmed business rule), and the Sales section (period-based,
// respects the selected Year, NOT cumulative).
//
// A real, important difference from the source document's own data
// model, confirmed directly against live data before writing any of
// this: this app stores one row per processing OUTPUT, sharing the
// same source_product/source_quantity across every row in the same
// transaction_group_id -- not one row with up to two destination
// columns. Deduplicated by group before summing the input side
// (Entree), or the shared source_quantity would be double-counted;
// the output side (Sortie) correctly sums every row as-is, since each
// one is a genuinely separate output.
export function useSeasonStocks({ year, standard = [] } = {}) {
  const { supplyChainId } = useAuth();

  return useQuery({
    queryKey: ['season-stocks', supplyChainId, year, standard.join(',')],
    queryFn: async () => {
      let receivedQuery = supabase.from('transactions').select('product, quantity, standard')
        .eq('supply_chain_id', supplyChainId).eq('direction', 'Received');
      let processingQuery = supabase.from('transactions').select('transaction_group_id, source_product, source_quantity, product, quantity, standard')
        .eq('supply_chain_id', supplyChainId).eq('direction', 'Processing');
      let sentAllTimeQuery = supabase.from('transactions').select('product, quantity, standard')
        .eq('supply_chain_id', supplyChainId).eq('direction', 'Send');
      let sentPeriodQuery = supabase.from('transactions').select('product, quantity, standard, transaction_date')
        .eq('supply_chain_id', supplyChainId).eq('direction', 'Send')
        .gte('transaction_date', `${year}-01-01`).lte('transaction_date', `${year}-12-31`);

      if (standard.length > 0) {
        receivedQuery = receivedQuery.in('standard', standard);
        processingQuery = processingQuery.in('standard', standard);
        sentAllTimeQuery = sentAllTimeQuery.in('standard', standard);
        sentPeriodQuery = sentPeriodQuery.in('standard', standard);
      }

      const [received, processing, sentAllTime, sentPeriod] = await Promise.all([
        receivedQuery, processingQuery, sentAllTimeQuery, sentPeriodQuery,
      ]);
      if (received.error) throw received.error;
      if (processing.error) throw processing.error;
      if (sentAllTime.error) throw sentAllTime.error;
      if (sentPeriod.error) throw sentPeriod.error;

      // Real dedup: one row per processing group for the input side.
      const seenGroups = new Set();
      const dedupedInputs = processing.data.filter((r) => {
        if (seenGroups.has(r.transaction_group_id)) return false;
        seenGroups.add(r.transaction_group_id);
        return true;
      });

      const receivedMarron = sumBy(received.data, 'product', BROWN, 'quantity');
      const receivedJaune = sumBy(received.data, 'product', YELLOW, 'quantity');
      const entreeMarron = sumBy(dedupedInputs, 'source_product', BROWN, 'source_quantity');
      const entreeJaune = sumBy(dedupedInputs, 'source_product', YELLOW, 'source_quantity');
      const sortieMarron = sumBy(processing.data, 'product', BROWN, 'quantity');
      const sortieJaune = sumBy(processing.data, 'product', YELLOW, 'quantity');
      const soldMarronAllTime = sumBy(sentAllTime.data, 'product', BROWN, 'quantity');
      const soldJauneAllTime = sumBy(sentAllTime.data, 'product', YELLOW, 'quantity');

      const lossRate = (entree, sortie) => (entree > 0 ? (entree - sortie) / entree : 0);

      return {
        stockRawMaterial: {
          marron: receivedMarron - entreeMarron,
          jaune: receivedJaune - entreeJaune,
          total: (receivedMarron - entreeMarron) + (receivedJaune - entreeJaune),
        },
        lossRate: {
          marron: lossRate(entreeMarron, sortieMarron),
          jaune: lossRate(entreeJaune, sortieJaune),
          total: lossRate(entreeMarron + entreeJaune, sortieMarron + sortieJaune),
          entreeMarron, entreeJaune, sortieMarron, sortieJaune,
        },
        stockFinal: {
          marron: sortieMarron - soldMarronAllTime,
          jaune: sortieJaune - soldJauneAllTime,
          total: (sortieMarron - soldMarronAllTime) + (sortieJaune - soldJauneAllTime),
        },
        sales: {
          marron: sumBy(sentPeriod.data, 'product', BROWN, 'quantity'),
          jaune: sumBy(sentPeriod.data, 'product', YELLOW, 'quantity'),
          total: sumBy(sentPeriod.data, 'product', BROWN, 'quantity') + sumBy(sentPeriod.data, 'product', YELLOW, 'quantity'),
        },
        // "Livraison de cire par mois" -- real gap deliberately left
        // out earlier for lack of a concrete spec, closed now that a
        // real screenshot of the source dashboard confirmed its exact
        // shape: a stacked monthly bar (Brown + Yellow) of deliveries
        // for the selected year, months with zero deliveries included
        // and shown as real zero bars, not skipped.
        monthlyDeliveries: MONTH_NAMES.map((label, i) => ({
          month: label,
          marron: sumBy(sentPeriod.data.filter((r) => new Date(r.transaction_date).getMonth() === i), 'product', BROWN, 'quantity'),
          jaune: sumBy(sentPeriod.data.filter((r) => new Date(r.transaction_date).getMonth() === i), 'product', YELLOW, 'quantity'),
        })),
      };
    },
    enabled: !!supplyChainId,
    staleTime: 30_000,
  });
}
