import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

const YELLOW = 'Beeswax-Yellow';
const LOCAL_PARTNER = 'Local Partner';

// Uses this app's own real, confirmed country spellings (verified
// directly against live data earlier), not assumed from the source
// document -- which itself flags its own SWITCH list as "never fully
// verified against real Pays spellings." This app stores "Benin"
// without an accent, for example, where the source's own version
// expected "Bénin".
const COUNTRY_ISO = {
  Togo: 'tg', Benin: 'bj', 'Burkina Faso': 'bf', Nigeria: 'ng',
  Mali: 'ml', Ghana: 'gh', "Côte d'Ivoire": 'ci', 'Sierra Leone': 'sl',
};

function sumField(rows, field) {
  return rows.reduce((sum, r) => sum + (Number(r[field]) || 0), 0);
}

// Builds the Indicators page's "Local Partners' Performance" table
// (Top 20) from the Power BI handoff document. Real business rules
// confirmed directly in the source document and matched exactly here:
// ranked/filtered to Top 20 by CONTRACT quantity (not delivered);
// Evolution (rank change) is based on DELIVERED quantity instead,
// explicitly clarified in the source as different from the ranking
// basis; % Cire Jaune is each actor's own ratio, not a company-wide
// share.
export function useIndicatorsLocalPartners({ year }) {
  const { supplyChainId } = useAuth();
  const prevYear = year ? Number(year) - 1 : null;

  return useQuery({
    queryKey: ['indicators-local-partners', supplyChainId, year],
    queryFn: async () => {
      const [actors, thisYearTx, lastYearTx, contracts] = await Promise.all([
        supabase.from('actors').select('id, contact_name, country').eq('supply_chain_id', supplyChainId).eq('actor_type', LOCAL_PARTNER),
        supabase.from('transactions').select('actor_id, product, quantity')
          .eq('supply_chain_id', supplyChainId).eq('direction', 'Received').not('actor_id', 'is', null)
          .gte('transaction_date', `${year}-01-01`).lte('transaction_date', `${year}-12-31`),
        supabase.from('transactions').select('actor_id, quantity')
          .eq('supply_chain_id', supplyChainId).eq('direction', 'Received').not('actor_id', 'is', null)
          .gte('transaction_date', `${prevYear}-01-01`).lte('transaction_date', `${prevYear}-12-31`),
        supabase.from('contracts').select('actor_id, expected_quantity').eq('supply_chain_id', supplyChainId).eq('year', Number(year)),
      ]);
      if (actors.error) throw actors.error;
      if (thisYearTx.error) throw thisYearTx.error;
      if (lastYearTx.error) throw lastYearTx.error;
      if (contracts.error) throw contracts.error;

      const localPartnerIds = new Set(actors.data.map((a) => a.id));
      const qtyThisYearByActor = {};
      thisYearTx.data.filter((t) => localPartnerIds.has(t.actor_id)).forEach((t) => {
        if (!qtyThisYearByActor[t.actor_id]) qtyThisYearByActor[t.actor_id] = { total: 0, yellow: 0 };
        qtyThisYearByActor[t.actor_id].total += Number(t.quantity) || 0;
        if (t.product === YELLOW) qtyThisYearByActor[t.actor_id].yellow += Number(t.quantity) || 0;
      });
      const qtyLastYearByActor = {};
      lastYearTx.data.filter((t) => localPartnerIds.has(t.actor_id)).forEach((t) => {
        qtyLastYearByActor[t.actor_id] = (qtyLastYearByActor[t.actor_id] || 0) + (Number(t.quantity) || 0);
      });
      const contractByActor = {};
      contracts.data.forEach((c) => {
        contractByActor[c.actor_id] = (contractByActor[c.actor_id] || 0) + (Number(c.expected_quantity) || 0);
      });

      const totalDeliveredAllPartners = sumField(Object.values(qtyThisYearByActor).map((v) => ({ total: v.total })), 'total');

      // Real ranking, matching the source's own two-rank/Evolution
      // approach exactly: rank by delivered quantity this year, rank
      // by delivered quantity last year (both DESC, ties broken by
      // actor id for a stable order), Evolution = last year's rank
      // minus this year's -- positive means moved up.
      const rankBy = (getQty) => {
        const sorted = [...actors.data].sort((a, b) => getQty(b.id) - getQty(a.id) || a.id.localeCompare(b.id));
        const ranks = {};
        sorted.forEach((a, i) => { ranks[a.id] = i + 1; });
        return ranks;
      };
      const rankThisYear = rankBy((id) => qtyThisYearByActor[id]?.total || 0);
      const rankLastYear = rankBy((id) => qtyLastYearByActor[id] || 0);

      const rows = actors.data.map((a) => {
        const qty = qtyThisYearByActor[a.id]?.total || 0;
        const qtyYellow = qtyThisYearByActor[a.id]?.yellow || 0;
        const contract = contractByActor[a.id] || 0;
        const isoCode = COUNTRY_ISO[a.country] || 'xx';
        return {
          actorId: a.id,
          name: a.contact_name,
          country: a.country,
          flagUrl: `https://flagcdn.com/w40/${isoCode}.png`,
          evolution: rankLastYear[a.id] - rankThisYear[a.id],
          contract,
          qty,
          pctAppro: totalDeliveredAllPartners > 0 ? qty / totalDeliveredAllPartners : 0,
          pctContrat: contract > 0 ? qty / contract : 0,
          qtyYellow,
          pctYellow: qty > 0 ? qtyYellow / qty : 0,
        };
      });

      return rows.sort((a, b) => b.contract - a.contract).slice(0, 20);
    },
    enabled: !!supplyChainId && !!year,
    staleTime: 30_000,
  });
}
