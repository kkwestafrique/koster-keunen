import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';

// Builds the same 14 metrics as the "Season" page's Initial row (7
// Potential KPI cards) and Achieve row (7 % gauges), as specified in
// the Power BI handoff document, using this app's own real, live
// data -- not a separate export.
//
// "Achieved" is defined here as: an actor with at least one real
// transaction (any direction -- Received, Send, or Processing) in the
// selected year. This is a real, deliberate choice made explicit here
// rather than guessed at silently -- the source document defines
// "Achieved" the same way conceptually ("actors with real activity"),
// but its own precise mechanics rely on Power BI's own pre-aggregated
// tables, which don't exist in this app's data model. When an actor
// counts as Achieved, all of that actor's own villages, beekeepers,
// and beehives count as Achieved too, matching the source's own
// per-actor rollup approach.
export function useSeasonMetrics({ year = '' } = {}) {
  const { supplyChainId } = useAuth();
  return useQuery({
    queryKey: ['season-metrics', supplyChainId, year],
    queryFn: async () => {
      const [actorsRes, beekeepersRes, txRes] = await Promise.all([
        supabase.from('actors').select('id, actor_type, country').eq('supply_chain_id', supplyChainId),
        supabase
          .from('beekeepers')
          .select('actor_id, village_id, gender, hives_traditional_single, hives_traditional_double, hives_modern, hives_other')
          .eq('supply_chain_id', supplyChainId)
          .not('actor_id', 'is', null),
        (() => {
          let q = supabase.from('transactions').select('actor_id').eq('supply_chain_id', supplyChainId).not('actor_id', 'is', null);
          if (year) q = q.gte('transaction_date', `${year}-01-01`).lte('transaction_date', `${year}-12-31`);
          return q;
        })(),
      ]);
      if (actorsRes.error) throw actorsRes.error;
      if (beekeepersRes.error) throw beekeepersRes.error;
      if (txRes.error) throw txRes.error;

      const actors = actorsRes.data;
      const beekeepers = beekeepersRes.data;
      const achievedActorIds = new Set(txRes.data.map((t) => t.actor_id));

      const countBy = (rows, pred) => {
        const local = { total: 0, byType: { 'Local Partner': 0, Aggregator: 0, 'Producer Organisation': 0 }, countries: new Set() };
        rows.forEach((a) => {
          if (pred && !pred(a)) return;
          local.total += 1;
          if (local.byType[a.actor_type] != null) local.byType[a.actor_type] += 1;
          if (a.country) local.countries.add(a.country);
        });
        return local;
      };

      const potentialActors = countBy(actors);
      const achievedActors = countBy(actors, (a) => achievedActorIds.has(a.id));

      const beekeeperStats = (rows) => {
        const villages = new Set();
        let male = 0, female = 0, hives = 0;
        rows.forEach((b) => {
          if (b.village_id) villages.add(b.village_id);
          if (b.gender === 'Male') male += 1;
          else if (b.gender === 'Female') female += 1;
          hives += (b.hives_traditional_single || 0) + (b.hives_traditional_double || 0)
            + (b.hives_modern || 0) + (b.hives_other || 0);
        });
        return { villages: villages.size, beekeepers: male + female, beehives: hives };
      };

      const potentialBk = beekeeperStats(beekeepers);
      const achievedBk = beekeeperStats(beekeepers.filter((b) => achievedActorIds.has(b.actor_id)));

      return {
        potential: {
          localPartners: potentialActors.byType['Local Partner'],
          countries: potentialActors.countries.size,
          aggregators: potentialActors.byType.Aggregator,
          producerOrganisations: potentialActors.byType['Producer Organisation'],
          villages: potentialBk.villages,
          beekeepers: potentialBk.beekeepers,
          beehives: potentialBk.beehives,
        },
        achieved: {
          localPartners: achievedActors.byType['Local Partner'],
          countries: achievedActors.countries.size,
          aggregators: achievedActors.byType.Aggregator,
          producerOrganisations: achievedActors.byType['Producer Organisation'],
          villages: achievedBk.villages,
          beekeepers: achievedBk.beekeepers,
          beehives: achievedBk.beehives,
        },
      };
    },
    enabled: !!supplyChainId,
    staleTime: 30_000,
  });
}
