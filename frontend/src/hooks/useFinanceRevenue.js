import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const BROWN = 'Beeswax-Brown';
const YELLOW = 'Beeswax-Yellow';
const CRUDE_WAX = 'Crude Wax';
const WAX_PRODUCTS = [BROWN, YELLOW, CRUDE_WAX];
// Same real, deliberate mapping as useBeekeepersInvolved.js: no exact
// "gâteau miel" match, mapped to both Honey and Crude Honey together.
const HONEY_PRODUCTS = ['Honey', 'Crude Honey'];

// Same real, deliberate XOF-conversion logic as useSeasonPurchases.js
// -- XOF-to-XOF is always rate 1, no stored row needed. A transaction
// with no rate on file for its currency/month is skipped from the
// total and flagged, not silently treated as zero.
function rateFor(rates, currency, year, month) {
  if (currency === 'XOF') return 1;
  const row = rates.find((r) => r.currency === currency && r.year === year && r.month === month);
  return row ? row.rate_to_xof : null;
}

// Builds Batch 4 of the Finance section: hives per involved beekeeper,
// land-use breakdown (mango/cashew/shea/forest/other), the % of
// involved beekeepers with at least one hive of each type, and average
// income/price/quantity per beekeeper, split by wax vs honey --
// confirmed via a real screenshot of the source dashboard.
export function useFinanceRevenue({ year }) {
  const { supplyChainId } = useAuth();

  return useQuery({
    queryKey: ['finance-revenue', supplyChainId, year],
    queryFn: async () => {
      const [beekeepers, tx, rates] = await Promise.all([
        supabase.from('beekeepers').select('id, hives_traditional_single, hives_traditional_double, hives_modern, hives_other, hive_cashew, hive_mango, hive_shea, hive_forest, hive_other_forage')
          .eq('supply_chain_id', supplyChainId),
        supabase.from('transactions').select('beekeeper_id, product, quantity, total_amount, currency, transaction_date')
          .eq('supply_chain_id', supplyChainId).eq('direction', 'Received').not('beekeeper_id', 'is', null)
          .gte('transaction_date', `${year}-01-01`).lte('transaction_date', `${year}-12-31`),
        supabase.from('exchange_rates').select('currency, year, month, rate_to_xof').eq('supply_chain_id', supplyChainId),
      ]);
      if (beekeepers.error) throw beekeepers.error;
      if (tx.error) throw tx.error;
      if (rates.error) throw rates.error;

      const involvedIds = new Set(tx.data.map((t) => t.beekeeper_id));
      const involvedBeekeepers = beekeepers.data.filter((b) => involvedIds.has(b.id));
      const totalHives = involvedBeekeepers.reduce((sum, b) =>
        sum + (Number(b.hives_traditional_single) || 0) + (Number(b.hives_traditional_double) || 0)
        + (Number(b.hives_modern) || 0) + (Number(b.hives_other) || 0), 0);

      // Land-use breakdown: summed hive counts by what the hive sits
      // on/near, and separately, the % of involved beekeepers with at
      // least one hive of that type -- two different real metrics
      // from the source dashboard, not the same number twice.
      const landUse = { mango: 0, cashew: 0, shea: 0, forest: 0, other: 0 };
      const hiveTypeHolders = { traditional1: 0, traditional2: 0, modern: 0, other: 0 };
      involvedBeekeepers.forEach((b) => {
        landUse.mango += Number(b.hive_mango) || 0;
        landUse.cashew += Number(b.hive_cashew) || 0;
        landUse.shea += Number(b.hive_shea) || 0;
        landUse.forest += Number(b.hive_forest) || 0;
        landUse.other += Number(b.hive_other_forage) || 0;
        if ((Number(b.hives_traditional_single) || 0) > 0) hiveTypeHolders.traditional1 += 1;
        if ((Number(b.hives_traditional_double) || 0) > 0) hiveTypeHolders.traditional2 += 1;
        if ((Number(b.hives_modern) || 0) > 0) hiveTypeHolders.modern += 1;
        if ((Number(b.hives_other) || 0) > 0) hiveTypeHolders.other += 1;
      });
      const landUseTotal = landUse.mango + landUse.cashew + landUse.shea + landUse.forest + landUse.other;
      const involvedCount = involvedBeekeepers.length;

      // Per-beekeeper income, split by product group. XOF-converted
      // amount and real quantity are summed only over transactions
      // that actually belong to that group, then divided by how many
      // real beekeepers were involved in that specific group -- not
      // the overall involved count, which would understate the
      // per-person average.
      const revenueFor = (products) => {
        const rows = tx.data.filter((t) => products.includes(t.product));
        const beekeeperIds = new Set(rows.map((t) => t.beekeeper_id));
        let amountXof = 0;
        const missingRates = new Set();
        rows.forEach((t) => {
          if (!t.total_amount || !t.currency || !t.transaction_date) return;
          const d = new Date(t.transaction_date);
          const rate = rateFor(rates.data, t.currency, d.getFullYear(), d.getMonth() + 1);
          if (rate == null) { missingRates.add(`${t.currency} ${d.getFullYear()}-${d.getMonth() + 1}`); return; }
          amountXof += Number(t.total_amount) * rate;
        });
        const qty = rows.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0);
        const count = beekeeperIds.size;
        return {
          avgIncome: count > 0 ? amountXof / count : 0,
          avgQty: count > 0 ? qty / count : 0,
          pricePerKg: qty > 0 ? amountXof / qty : 0,
          missingRates: Array.from(missingRates),
        };
      };

      const wax = revenueFor(WAX_PRODUCTS);
      const honey = revenueFor(HONEY_PRODUCTS);
      const overall = revenueFor([...WAX_PRODUCTS, ...HONEY_PRODUCTS, 'Royal Jelly']);

      return {
        hivesPerBeekeeper: involvedCount > 0 ? totalHives / involvedCount : 0,
        landUse: Object.fromEntries(Object.entries(landUse).map(([k, v]) => [k, landUseTotal > 0 ? v / landUseTotal : 0])),
        hiveTypeHolderRatio: Object.fromEntries(Object.entries(hiveTypeHolders).map(([k, v]) => [k, involvedCount > 0 ? v / involvedCount : 0])),
        avgIncomeOverall: overall.avgIncome,
        wax,
        honey,
      };
    },
    enabled: !!supplyChainId && !!year,
    staleTime: 30_000,
  });
}
