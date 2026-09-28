// Bulk beekeeper upload used to reject any row whose village wasn't already in the
// villages table, even though single-add (findOrCreateVillage) has always created
// new villages on the fly. Validation now flags such rows with `_newVillageName`;
// this resolves each flag into a real village_id right before insert -- same match
// rule as findOrCreateVillage (case-insensitive name, same country/state/lga) --
// deduplicated within the batch so five beekeepers from one new village create ONE
// village row, not five.
//
// Mutates `validRows` in place (sets village_id, removes the flag). Throws if a
// village cannot be created, aborting the import before anything is written.
export async function resolveNewVillages(client, validRows, supplyChainId) {
  const newVillageCache = {};
  for (const row of validRows) {
    if (!row._newVillageName) continue;
    const cacheKey = [row._newVillageName, row.country, row.state_region, row.lga_municipality]
      .map((s) => String(s || '').toLowerCase()).join('|');
    if (!newVillageCache[cacheKey]) {
      const { data: existing } = await client.from('villages').select('id')
        .eq('supply_chain_id', supplyChainId)
        .eq('country', row.country).eq('state_region', row.state_region).eq('lga_municipality', row.lga_municipality)
        .ilike('name', row._newVillageName)
        .maybeSingle();
      if (existing) {
        newVillageCache[cacheKey] = existing.id;
      } else {
        const { data: created, error: createError } = await client.from('villages')
          .insert([{ country: row.country, state_region: row.state_region, lga_municipality: row.lga_municipality, name: row._newVillageName, supply_chain_id: supplyChainId }])
          .select('id').single();
        if (createError) throw createError;
        newVillageCache[cacheKey] = created.id;
      }
    }
    row.village_id = newVillageCache[cacheKey];
    delete row._newVillageName;
  }
}
