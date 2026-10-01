// Real database access for the Report page, extracted out of
// pages/report/Report.jsx -- pages in this project shouldn't talk to
// Supabase directly; that belongs in the hooks/lib layer, matching the
// pattern every other page already follows via its dedicated hook file.
// Report.jsx itself now only decides WHICH report to build and WHAT to
// do with the result (file naming, download, tracking row) -- not how
// to fetch the rows.

import { supabase } from './supabaseClient';

// PostgREST returns at most 1000 rows per request. Real gap: a single
// request silently truncated every report past 1000 rows, which the
// historical import (2,092 beekeeper transactions) would have hit.
// Pages through until a short page comes back.
export async function fetchAll(buildQuery) {
  const PAGE = 1000;
  const out = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await buildQuery().range(from, from + PAGE - 1);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

export const ACTOR_EMBED = 'actors!actor_id(traceability_code, contact_name, actor_type)';

export async function loadReportData(report, filters, supplyChainId) {
  const inChain = (q) => q.eq('supply_chain_id', supplyChainId);
  const data = { beekeepers: [], villagesById: {}, transactions: [], actors: [], connections: [], contracts: [] };
  const key = report.key;
  const needsBeekeepers = ['beekeeperList', 'beekeepersPotential', 'beekeepersAchieved', 'actorsPotential', 'actorsAchieved'].includes(key);

  if (needsBeekeepers) {
    // Same rule as the Beekeepers list and Dashboard: beekeepers with no
    // owning actor are excluded, so counts agree across all three.
    data.beekeepers = await fetchAll(() => inChain(supabase.from('beekeepers').select('id, created_at, traceability_code, internal_code, full_name, gender, year_of_birth, national_id, linked_producer_organisation, contact_phone, village_id, hives_traditional_single, hives_traditional_double, hives_modern, hives_other, hive_cashew, hive_mango, hive_shea, hive_forest, hive_other_forage, commitment, standards, charter_signed, actor_id')).not('actor_id', 'is', null).order('id'));
  }
  if (key === 'beekeeperList') {
    const villages = await fetchAll(() => inChain(supabase.from('villages').select('id, name, country, state_region, lga_municipality')).order('id'));
    data.villagesById = Object.fromEntries(villages.map((v) => [v.id, v]));
  }
  if (['beekeeperList', 'beekeepersAchieved', 'actorsAchieved'].includes(key)) {
    data.transactions = await fetchAll(() => inChain(supabase.from('transactions').select('id, beekeeper_id, transaction_date, product, direction'))
      .not('beekeeper_id', 'is', null).order('id'));
  }
  if (key === 'actorsPotential' || key === 'actorsAchieved') {
    data.actors = await fetchAll(() => inChain(supabase.from('actors').select('id, traceability_code, created_at, contact_name, actor_type, country, state_region, lga_municipality, standards')).order('id'));
    data.connections = await fetchAll(() => inChain(supabase.from('connections').select('actor_from_id, actor_to_id, status')).order('id'));
  }

  const inRange = (q, field) => {
    let out = q;
    if (filters.dateFrom) out = out.gte(field, filters.dateFrom);
    if (filters.dateTo) out = out.lte(field, filters.dateTo);
    if (filters.standards.length > 0) out = out.in('standard', filters.standards);
    return out;
  };
  if (key === 'contract') {
    data.contracts = await fetchAll(() => inRange(inChain(supabase.from('contracts').select(`*, ${ACTOR_EMBED}`)), 'signature_date').order('id'));
  }
  if (['receivedBeekeepers', 'receivedActors', 'sent', 'processing'].includes(key)) {
    data.transactions = await fetchAll(() => {
      let q = inRange(inChain(supabase.from('transactions')
        .select(`*, ${ACTOR_EMBED}, beekeepers(traceability_code, full_name, internal_code)`)), 'transaction_date')
        .eq('direction', report.direction);
      // Processing is filtered per batch in the builder (a batch matches
      // if its input or any output is a selected product), so a batch is
      // never half-dropped by a row-level filter here.
      if (key !== 'processing' && filters.products.length > 0) q = q.in('product', filters.products);
      return q.order('id');
    });
  }
  return data;
}

// Current actor's own display name, used to build the exported file's
// name (e.g. "Beekeepers_List_OLD_LEVI_MULTIBIZ_SERVICES_LTD.xlsx"),
// matching the old MIS's naming convention.
export async function getCurrentActorName(currentActorId) {
  if (!currentActorId) return '';
  const { data } = await supabase.from('actors').select('contact_name').eq('id', currentActorId).maybeSingle();
  return data?.contact_name || '';
}
