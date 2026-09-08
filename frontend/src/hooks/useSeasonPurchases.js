import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const BROWN = 'Beeswax-Brown';
const YELLOW = 'Beeswax-Yellow';

// Builds the Season page's "Purchases/Receptions" section from the
// Power BI handoff document, using this app's own real data.
//
// XOF-to-XOF is always rate 1, handled directly here rather than
// needing a stored rate row -- a deliberate fix for the exact "known
// unresolved gap" the source document flags in its own version (XOF
// rows missing from the manually-maintained rate table, causing
// transactions to silently drop out of the total).
function rateFor(rates, currency, year, month) {
  if (currency === 'XOF') return 1;
  const row = rates.find((r) => r.currency === currency && r.year === year && r.month === month);
  return row ? row.rate_to_xof : null;
}

function sumByProduct(rows, product, field) {
  return rows.filter((r) => r.product === product).reduce((sum, r) => sum + (Number(r[field]) || 0), 0);
}

export function useSeasonPurchases({ year }) {
  const { supplyChainId } = useAuth();
  const prevYear = year ? Number(year) - 1 : null;

  return useQuery({
    queryKey: ['season-purchases', supplyChainId, year],
    queryFn: async () => {
      const [thisYearTx, lastYearTx, contracts, rates] = await Promise.all([
        supabase.from('transactions').select('product, quantity, total_amount, currency, transaction_date')
          .eq('supply_chain_id', supplyChainId).eq('direction', 'Received')
          .gte('transaction_date', `${year}-01-01`).lte('transaction_date', `${year}-12-31`),
        supabase.from('transactions').select('product, quantity, transaction_date')
          .eq('supply_chain_id', supplyChainId).eq('direction', 'Received')
          .gte('transaction_date', `${prevYear}-01-01`).lte('transaction_date', `${prevYear}-12-31`),
        supabase.from('contracts').select('product, expected_quantity, year').eq('supply_chain_id', supplyChainId),
        supabase.from('exchange_rates').select('currency, year, month, rate_to_xof').eq('supply_chain_id', supplyChainId),
      ]);
      if (thisYearTx.error) throw thisYearTx.error;
      if (lastYearTx.error) throw lastYearTx.error;
      if (contracts.error) throw contracts.error;
      if (rates.error) throw rates.error;

      const contractsThisYear = contracts.data.filter((c) => c.year === Number(year));
      const contractsLastYear = contracts.data.filter((c) => c.year === prevYear);

      const qtyMarron = sumByProduct(thisYearTx.data, BROWN, 'quantity');
      const qtyJaune = sumByProduct(thisYearTx.data, YELLOW, 'quantity');
      const contractMarron = sumByProduct(contractsThisYear, BROWN, 'expected_quantity');
      const contractJaune = sumByProduct(contractsThisYear, YELLOW, 'expected_quantity');

      // Year-over-year, year-to-date basis: matches the source
      // document's own logic exactly -- quantity is filtered to
      // months up through the latest real month of data in the
      // selected year, but the contract total it's compared against
      // is the FULL year's contract, not YTD-filtered.
      const maxMonth = thisYearTx.data.length > 0
        ? Math.max(...thisYearTx.data.map((t) => new Date(t.transaction_date).getMonth() + 1))
        : 0;
      const ytdQty = (rows, product) => rows
        .filter((r) => r.product === product && new Date(r.transaction_date).getMonth() + 1 <= maxMonth)
        .reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

      const pctYtd = (qty, contractTotal) => (contractTotal > 0 ? qty / contractTotal : 0);
      const yoy = (product, contractField) => {
        const thisYtd = ytdQty(thisYearTx.data, product);
        const lastYtd = ytdQty(lastYearTx.data, product);
        const contractThis = contractField === 'total' ? contractMarron + contractJaune : sumByProduct(contractsThisYear, product, 'expected_quantity');
        const contractLast = contractField === 'total'
          ? sumByProduct(contractsLastYear, BROWN, 'expected_quantity') + sumByProduct(contractsLastYear, YELLOW, 'expected_quantity')
          : sumByProduct(contractsLastYear, product, 'expected_quantity');
        return pctYtd(thisYtd, contractThis) - pctYtd(lastYtd, contractLast);
      };

      // Currency-converted total. A transaction whose currency/year/
      // month has no rate on file is skipped from the sum rather than
      // silently treated as zero or as XOF -- flagged separately so a
      // real gap in the rate table is visible, not hidden.
      let amountXof = 0;
      const missingRateCurrencies = new Set();
      thisYearTx.data.forEach((t) => {
        if (!t.total_amount || !t.currency || !t.transaction_date) return;
        const d = new Date(t.transaction_date);
        const rate = rateFor(rates.data, t.currency, d.getFullYear(), d.getMonth() + 1);
        if (rate == null) { missingRateCurrencies.add(`${t.currency} ${d.getFullYear()}-${d.getMonth() + 1}`); return; }
        amountXof += Number(t.total_amount) * rate;
      });

      return {
        qtyMarron, qtyJaune, qtyTotal: qtyMarron + qtyJaune,
        contractMarron, contractJaune, contractTotal: contractMarron + contractJaune,
        pctMarron: pctYtd(qtyMarron, contractMarron),
        pctJaune: pctYtd(qtyJaune, contractJaune),
        pctTotal: pctYtd(qtyMarron + qtyJaune, contractMarron + contractJaune),
        yoyMarron: yoy(BROWN, 'marron'),
        yoyJaune: yoy(YELLOW, 'jaune'),
        yoyTotal: yoy(null, 'total'),
        amountXof,
        missingRateCurrencies: Array.from(missingRateCurrencies),
      };
    },
    enabled: !!supplyChainId && !!year,
    staleTime: 30_000,
  });
}
