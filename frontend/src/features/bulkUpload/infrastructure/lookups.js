import { supabase } from '@/lib/supabaseClient';

// Resolves the human-readable codes people actually type into a CSV/Excel
// sheet (village name, actor/beekeeper traceability code) into the real
// UUID foreign keys the tables need. Without this, bulk rows were being
// inserted with columns like village_name/actor_code/beekeeper_code, which
// don't exist on beekeepers/transactions at all — Supabase rejects the
// whole batch before anything is written.
export async function fetchLookups(supplyChainId, templateKey) {
  const lookups = { villagesByName: {}, actorsByCode: {}, beekeepersByCode: {} };

  if (templateKey === 'beekeepers') {
    const { data, error } = await supabase.from('villages').select('id, name, country, state_region, lga_municipality').eq('supply_chain_id', supplyChainId);
    if (error) throw error;
    data.forEach((v) => {
      const key = [v.name, v.country, v.state_region, v.lga_municipality].map((s) => (s || '').trim().toLowerCase()).join('|');
      lookups.villagesByName[key] = v.id;
    });
  }

  // Real, severe gap found via user report: receiveStock's beekeeper_code
  // column is required: true, checked against lookups.beekeepersByCode
  // at validation time -- but receiveStock was missing from this
  // condition, so that lookup table was always empty for it. Every
  // Receive Stock bulk upload has been failing "Beekeeper code ... not
  // found" for every single beekeeper, correct or not, with no way to
  // ever pass. Confirmed live: a beekeeper genuinely in the database
  // (KKWA-TG-000002, "Samson") still failed this exact check.
  if (templateKey === 'transactions' || templateKey === 'contracts' || templateKey === 'receiveStock') {
    const [actorsRes, beekeepersRes] = await Promise.all([
      supabase.from('actors').select('id, traceability_code').eq('supply_chain_id', supplyChainId),
      supabase.from('beekeepers').select('id, traceability_code').eq('supply_chain_id', supplyChainId),
    ]);
    if (actorsRes.error) throw actorsRes.error;
    if (beekeepersRes.error) throw beekeepersRes.error;
    actorsRes.data.forEach((a) => { if (a.traceability_code) lookups.actorsByCode[a.traceability_code.trim().toLowerCase()] = a.id; });
    beekeepersRes.data.forEach((b) => { if (b.traceability_code) lookups.beekeepersByCode[b.traceability_code.trim().toLowerCase()] = b.id; });
  }

  return lookups;
}
