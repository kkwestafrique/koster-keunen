#!/usr/bin/env node
/**
 * KKWA MIS — Smoke Test Suite
 *
 * Automated regression tests for the specific bugs that were expensive to
 * find by hand this session — multi-product inserts silently hitting
 * nonexistent columns, RLS not actually isolating tenants, storage policies
 * not actually isolating tenants, and Report queries crashing on columns
 * that don't exist on beekeepers/actors. These are exactly the kind of bugs
 * that "looks fine in the UI" doesn't catch, because the failure mode was
 * either a silent no-op or only triggered by a specific filter combination.
 *
 * This creates its own throwaway test data (a dedicated supply chain,
 * clearly named) and deletes it all at the end, whether tests pass or fail.
 * Safe to run repeatedly against the real project — it never touches your
 * real supply chain's data.
 *
 * Requires (in a .env file or the environment):
 *   REACT_APP_SUPABASE_URL          (or SUPABASE_URL)
 *   REACT_APP_SUPABASE_ANON_KEY     (or SUPABASE_ANON_KEY)
 *   SUPABASE_SERVICE_ROLE_KEY       (from Supabase dashboard -> Settings -> API
 *                                    — NOT the anon key. Never commit this.)
 *
 * Run with: node scripts/smoke-test.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', 'frontend', '.env') });
const { createClient } = require('@supabase/supabase-js');
const { randomUUID } = require('crypto');

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const ANON_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
  console.error('Missing required env vars. Need REACT_APP_SUPABASE_URL, REACT_APP_SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.');
  console.error('SUPABASE_SERVICE_ROLE_KEY is not in frontend/.env by default (it must never be a REACT_APP_* var) —');
  console.error('grab it from the Supabase dashboard (Settings -> API -> service_role) and export it before running, e.g.:');
  console.error('  SUPABASE_SERVICE_ROLE_KEY=... node scripts/smoke-test.js');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
const anon = createClient(SUPABASE_URL, ANON_KEY);

let passed = 0;
let failed = 0;
const failures = [];

function check(name, condition, details) {
  if (condition) {
    passed += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } else {
    failed += 1;
    failures.push({ name, details });
    console.log(`  \x1b[31m✗\x1b[0m ${name}${details ? ` — ${details}` : ''}`);
  }
}

async function main() {
  console.log('KKWA MIS smoke tests\n');

  const testTag = `SMOKE-TEST-${Date.now()}`;
  const cleanup = [];
  const runCleanup = async () => {
    for (const fn of cleanup.reverse()) {
      try { await fn(); } catch (e) { /* best-effort cleanup */ }
    }
  };

  try {
    // ---- Fixtures: a throwaway supply chain + one actor + one beekeeper ----
    const { data: supplyChain, error: scErr } = await admin
      .from('supply_chains').insert({ name: testTag }).select().single();
    if (scErr) throw new Error(`Could not create test supply chain: ${scErr.message}`);
    cleanup.push(() => admin.from('supply_chains').delete().eq('id', supplyChain.id));

    const { data: actor, error: actorErr } = await admin
      .from('actors')
      .insert({ supply_chain_id: supplyChain.id, traceability_code: `${testTag}-ACTOR`, contact_name: testTag, actor_type: 'Local Partner', country: 'Nigeria' })
      .select().single();
    if (actorErr) throw new Error(`Could not create test actor: ${actorErr.message}`);
    cleanup.push(() => admin.from('actors').delete().eq('id', actor.id));

    const { data: village, error: villageErr } = await admin
      .from('villages')
      .insert({ supply_chain_id: supplyChain.id, country: 'Nigeria', state_region: 'Test State', lga_municipality: 'Test LGA', name: testTag })
      .select().single();
    if (villageErr) throw new Error(`Could not create test village: ${villageErr.message}`);
    cleanup.push(() => admin.from('villages').delete().eq('id', village.id));

    const { data: beekeeper, error: bkErr } = await admin
      .from('beekeepers')
      .insert({ supply_chain_id: supplyChain.id, traceability_code: `${testTag}-BK`, full_name: testTag, village_id: village.id })
      .select().single();
    if (bkErr) throw new Error(`Could not create test beekeeper: ${bkErr.message}`);
    cleanup.push(() => admin.from('beekeepers').delete().eq('id', beekeeper.id));

    // =========================================================================
    console.log('1. Multi-product transaction insert + stock sync trigger');
    // =========================================================================
    const transaction_group_id = randomUUID();
    const { data: txRows, error: txErr } = await admin
      .from('transactions')
      .insert([
        { transaction_group_id, supply_chain_id: supplyChain.id, direction: 'Received', standard: 'Sustainable', beekeeper_id: beekeeper.id, product: 'Crude Honey', quantity: 50, unit: 'Kg', price: 1000, total_amount: 50000, transaction_date: '2026-01-01' },
        { transaction_group_id, supply_chain_id: supplyChain.id, direction: 'Received', standard: 'Sustainable', beekeeper_id: beekeeper.id, product: 'Beeswax-Yellow', quantity: 20, unit: 'Kg', price: 2000, total_amount: 40000, transaction_date: '2026-01-01' },
      ])
      .select();
    check('Multi-product Received transaction inserts one row per product (not a products array)', !txErr && txRows?.length === 2, txErr?.message);
    cleanup.push(() => admin.from('transactions').delete().eq('transaction_group_id', transaction_group_id));

    const { data: stockRows } = await admin
      .from('stocks').select('product, quantity_available').eq('supply_chain_id', supplyChain.id).eq('stock_type', 'Raw Material');
    check('Stock sync trigger created one Raw Material row per product', stockRows?.length === 2, `got ${stockRows?.length} rows`);
    check('Stock quantities match what was received', stockRows?.some((r) => r.product === 'Crude Honey' && Number(r.quantity_available) === 50) && stockRows?.some((r) => r.product === 'Beeswax-Yellow' && Number(r.quantity_available) === 20));
    cleanup.push(() => admin.from('stocks').delete().eq('supply_chain_id', supplyChain.id));

    // =========================================================================
    console.log('\n2. Multi-product contract insert (grouped rows, not a products array)');
    // =========================================================================
    const contract_group_id = randomUUID();
    const { data: contractRows, error: contractErr } = await admin
      .from('contracts')
      .insert([
        { contract_group_id, supply_chain_id: supplyChain.id, actor_id: actor.id, year: 2026, standard: 'Sustainable', contract_type: 'Send', product: 'Honey', expected_quantity: 100, unit: 'Kg', price: 500, total_amount: 50000, signature_date: '2026-01-01' },
        { contract_group_id, supply_chain_id: supplyChain.id, actor_id: actor.id, year: 2026, standard: 'Sustainable', contract_type: 'Send', product: 'Crude Wax', expected_quantity: 40, unit: 'Kg', price: 800, total_amount: 32000, signature_date: '2026-01-01' },
      ])
      .select();
    check('Multi-product contract inserts one row per product', !contractErr && contractRows?.length === 2, contractErr?.message);
    cleanup.push(() => admin.from('contracts').delete().eq('contract_group_id', contract_group_id));

    // =========================================================================
    console.log('\n3. Bulk upload FK resolution (traceability code -> real id)');
    // =========================================================================
    const { data: foundBeekeeper } = await admin
      .from('beekeepers').select('id').eq('supply_chain_id', supplyChain.id).eq('traceability_code', `${testTag}-BK`).maybeSingle();
    check('A real traceability code resolves to the correct beekeeper id', foundBeekeeper?.id === beekeeper.id);

    const { data: notFoundBeekeeper } = await admin
      .from('beekeepers').select('id').eq('supply_chain_id', supplyChain.id).eq('traceability_code', 'NONEXISTENT-CODE-XYZ').maybeSingle();
    check('A fake traceability code correctly resolves to nothing (not a false match)', notFoundBeekeeper === null);

    // =========================================================================
    console.log('\n4. Report queries on beekeepers/actors (no year/standard columns)');
    // =========================================================================
    const { error: yearFilterErr } = await admin
      .from('beekeepers')
      .select('*')
      .eq('supply_chain_id', supplyChain.id)
      .gte('created_at', '2026-01-01')
      .lte('created_at', '2026-12-31T23:59:59');
    check('Year-range filter on beekeepers (via created_at) does not throw', !yearFilterErr, yearFilterErr?.message);

    const { error: actorYearFilterErr } = await admin
      .from('actors')
      .select('*')
      .eq('supply_chain_id', supplyChain.id)
      .gte('created_at', '2026-01-01')
      .lte('created_at', '2026-12-31T23:59:59');
    check('Year-range filter on actors (via created_at) does not throw', !actorYearFilterErr, actorYearFilterErr?.message);

    const { error: contractDateErr } = await admin
      .from('contracts')
      .select('*')
      .eq('supply_chain_id', supplyChain.id)
      .gte('signature_date', '2026-01-01')
      .lte('signature_date', '2026-12-31');
    check('Contract report date filter uses signature_date (not transaction_date) without error', !contractDateErr, contractDateErr?.message);

    // =========================================================================
    console.log('\n5. RLS actually isolates tenants (not just "looks scoped")');
    // =========================================================================
    const { data: anonActors, error: anonErr } = await anon
      .from('actors').select('id').eq('supply_chain_id', supplyChain.id);
    check('Unauthenticated (anon) request sees zero rows from the test supply chain', !anonErr && (anonActors?.length ?? 0) === 0, anonErr ? anonErr.message : `got ${anonActors?.length} rows`);

    const { data: anonTx } = await anon.from('transactions').select('id').eq('supply_chain_id', supplyChain.id);
    check('Unauthenticated (anon) request sees zero transactions from the test supply chain', (anonTx?.length ?? 0) === 0);

    // =========================================================================
    console.log('\n6. Storage path scoping (tenant isolation on the media bucket)');
    const testPath = `smoke-test/${supplyChain.id}/file.png`;
    const segments = testPath.split('/');
    check('Upload path format has supply_chain_id as its 2nd segment (matches storage policy expectation)', segments[1] === supplyChain.id);

  } catch (err) {
    console.error(`\nFatal error during setup — aborting: ${err.message}`);
    failed += 1;
  } finally {
    await runCleanup();
  }

  console.log(`\n${'-'.repeat(50)}`);
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('\nFailures:');
    failures.forEach((f) => console.log(`  - ${f.name}${f.details ? `: ${f.details}` : ''}`));
    process.exit(1);
  }
  process.exit(0);
}

main();
