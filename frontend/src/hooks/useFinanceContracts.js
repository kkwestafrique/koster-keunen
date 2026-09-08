import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const LOCAL_PARTNER = 'Local Partner';

// Same real, deliberate XOF-conversion logic as useSeasonPurchases.js
// and useFinanceRevenue.js.
function rateFor(rates, currency, year, month) {
  if (currency === 'XOF') return 1;
  const row = rates.find((r) => r.currency === currency && r.year === year && r.month === month);
  return row ? row.rate_to_xof : null;
}

function convertToXof(rows, rates, dateField) {
  let total = 0;
  const missing = new Set();
  rows.forEach((r) => {
    if (!r.total_amount || !r.currency || !r[dateField]) return;
    const d = new Date(r[dateField]);
    const rate = rateFor(rates, r.currency, d.getFullYear(), d.getMonth() + 1);
    if (rate == null) { missing.add(`${r.currency} ${d.getFullYear()}-${d.getMonth() + 1}`); return; }
    total += Number(r.total_amount) * rate;
  });
  return { total, missing: Array.from(missing) };
}

// Builds Batch 5 of the Finance section, completing it: contract value
// vs actual purchase value (both in XOF), advance payment, and average
// price paid to Local Partners specifically -- confirmed via a real
// screenshot of the source dashboard.
//
// Real, honest gap: "Prime qualité" (quality premium) from the source
// dashboard has no underlying field anywhere in this app's schema --
// checked both contracts and transactions directly before concluding
// this. Left out entirely rather than invented from nothing; there's
// no real number to compute here without a genuinely new field this
// app doesn't have yet.
export function useFinanceContracts({ year }) {
  const { supplyChainId } = useAuth();

  return useQuery({
    queryKey: ['finance-contracts', supplyChainId, year],
    queryFn: async () => {
      const [contracts, receivedFromLocalPartners, rates] = await Promise.all([
        supabase.from('contracts').select('total_amount, advance_amount_paid, currency, signature_date')
          .eq('supply_chain_id', supplyChainId).eq('year', Number(year)),
        supabase.from('transactions').select('quantity, total_amount, currency, transaction_date, actors!inner(actor_type)')
          .eq('supply_chain_id', supplyChainId).eq('direction', 'Received')
          .eq('actors.actor_type', LOCAL_PARTNER)
          .gte('transaction_date', `${year}-01-01`).lte('transaction_date', `${year}-12-31`),
        supabase.from('exchange_rates').select('currency, year, month, rate_to_xof').eq('supply_chain_id', supplyChainId),
      ]);
      if (contracts.error) throw contracts.error;
      if (receivedFromLocalPartners.error) throw receivedFromLocalPartners.error;
      if (rates.error) throw rates.error;

      const contractValue = convertToXof(contracts.data, rates.data, 'signature_date');
      const advanceRows = contracts.data.map((c) => ({ ...c, total_amount: c.advance_amount_paid }));
      const advance = convertToXof(advanceRows, rates.data, 'signature_date');
      const realized = convertToXof(receivedFromLocalPartners.data, rates.data, 'transaction_date');

      const localPartnerQty = receivedFromLocalPartners.data.reduce((sum, r) => sum + (Number(r.quantity) || 0), 0);

      return {
        contractValue: contractValue.total,
        realizedValue: realized.total,
        completionRate: contractValue.total > 0 ? realized.total / contractValue.total : 0,
        advance: advance.total,
        advancePctOfContract: contractValue.total > 0 ? advance.total / contractValue.total : 0,
        advancePctOfRealized: realized.total > 0 ? advance.total / realized.total : 0,
        avgPriceLocalPartners: localPartnerQty > 0 ? realized.total / localPartnerQty : 0,
        missingRates: Array.from(new Set([...contractValue.missing, ...advance.missing, ...realized.missing])),
      };
    },
    enabled: !!supplyChainId && !!year,
    staleTime: 30_000,
  });
}
