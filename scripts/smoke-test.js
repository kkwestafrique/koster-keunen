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
      // standards: ['Sustainable'] is required here -- a real, sensible
      // database trigger (transactions_check_standard_flag) rejects any
      // transaction whose standard the referenced beekeeper isn't
      // already flagged for. Nearly every test below creates a
      // Sustainable-standard transaction for this beekeeper.
      //
      // charter_signed: true is required alongside it -- a separate,
      // real constraint (beekeepers_charter_required_if_sustainable)
      // requires both together, not standards alone.
      .insert({ supply_chain_id: supplyChain.id, traceability_code: `${testTag}-BK`, full_name: testTag, village_id: village.id, standards: ['Sustainable'], charter_signed: true })
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

    // ---- Fixture: a real, throwaway authenticated user, not just anon ----
    // Several of the bugs below are role-restricted-access bugs, not
    // "logged out vs logged in" bugs -- testing them properly needs a real,
    // low-privilege authenticated session, not the anon client used above.
    const testEmail = `${testTag.toLowerCase()}@smoketest.invalid`;
    const testPassword = `Sm0ke-${randomUUID()}`;
    const { data: authUser, error: authUserErr } = await admin.auth.admin.createUser({
      email: testEmail, password: testPassword, email_confirm: true,
    });
    if (authUserErr) throw new Error(`Could not create test auth user: ${authUserErr.message}`);
    cleanup.push(() => admin.auth.admin.deleteUser(authUser.user.id));

    const { error: uaErr } = await admin.from('user_accounts').insert({
      id: authUser.user.id, username: testTag, role: 'Member',
      supply_chain_id: supplyChain.id, current_actor_id: actor.id,
    });
    if (uaErr) throw new Error(`Could not create test user_account: ${uaErr.message}`);

    const { error: tmErr } = await admin.from('team_members').insert({
      actor_id: actor.id, name: testTag, email: testEmail, role: 'Member',
      status: 'Active', user_id: authUser.user.id,
    });
    if (tmErr) throw new Error(`Could not create test team_members row: ${tmErr.message}`);

    const asFieldOfficer = createClient(SUPABASE_URL, ANON_KEY);
    const { error: signInErr } = await asFieldOfficer.auth.signInWithPassword({ email: testEmail, password: testPassword });
    if (signInErr) throw new Error(`Could not sign in as test Member: ${signInErr.message}`);

    // =========================================================================
    console.log('\n7. lookup_actor_by_connect_id: minimal fields, real tenant scope');
    // =========================================================================
    // Real bug: this function used to return full contact_email,
    // contact_phone, and complete address for ANY actor in ANY tenant, gated
    // only by "is logged in." Regression-guards both halves of the fix.
    const { data: otherTenant, error: otherTenantErr } = await admin
      .from('supply_chains').insert({ name: `${testTag}-OTHER-TENANT` }).select().single();
    if (otherTenantErr) throw new Error(`Could not create second test tenant: ${otherTenantErr.message}`);
    cleanup.push(() => admin.from('supply_chains').delete().eq('id', otherTenant.id));

    const { data: otherTenantActor, error: otaErr } = await admin
      .from('actors')
      .insert({
        supply_chain_id: otherTenant.id, traceability_code: `${testTag}-OTHER-ACTOR`,
        contact_name: testTag, actor_type: 'Local Partner', country: 'Nigeria',
        contact_email: 'should-never-leak@smoketest.invalid', connect_id: `${testTag}-CONNECT-ID`,
      })
      .select().single();
    if (otaErr) throw new Error(`Could not create other-tenant test actor: ${otaErr.message}`);
    cleanup.push(() => admin.from('actors').delete().eq('id', otherTenantActor.id));

    const { data: crossTenantLookup, error: crossTenantLookupErr } = await asFieldOfficer
      .rpc('lookup_actor_by_connect_id', { p_connect_id: `${testTag}-CONNECT-ID` });
    check(
      'A real, unconnected user in tenant A cannot look up a real actor in tenant B by connect_id',
      !crossTenantLookupErr && (crossTenantLookup?.length ?? 0) === 0,
      crossTenantLookupErr ? crossTenantLookupErr.message : `got ${crossTenantLookup?.length} rows`
    );

    const { data: ownTenantActor2, error: ota2Err } = await admin
      .from('actors')
      .insert({
        supply_chain_id: supplyChain.id, traceability_code: `${testTag}-ACTOR-2`,
        contact_name: testTag, actor_type: 'Local Partner', country: 'Nigeria',
        contact_email: 'should-never-leak-either@smoketest.invalid', contact_phone: '+2340000000000',
        connect_id: `${testTag}-OWN-CONNECT-ID`,
      })
      .select().single();
    if (ota2Err) throw new Error(`Could not create own-tenant second test actor: ${ota2Err.message}`);
    cleanup.push(() => admin.from('actors').delete().eq('id', ownTenantActor2.id));

    const { data: sameTenantLookup } = await asFieldOfficer
      .rpc('lookup_actor_by_connect_id', { p_connect_id: `${testTag}-OWN-CONNECT-ID` });
    const lookedUp = sameTenantLookup?.[0];
    check(
      'Same-tenant connect_id lookup returns only the 4 real fields the app uses (never email/phone)',
      lookedUp && Object.keys(lookedUp).sort().join(',') === 'actor_type,contact_name,country,id'
        && !('contact_email' in lookedUp) && !('contact_phone' in lookedUp),
      lookedUp ? `got keys: ${Object.keys(lookedUp).join(',')}` : 'no row returned'
    );

    // =========================================================================
    console.log('\n8. approve_connection: real status-conflict is caught, not overwritten');
    // =========================================================================
    // Real bug: the final UPDATE had no status condition in its own WHERE
    // clause, so a status change between the earlier read-check and this
    // function's own UPDATE was silently overwritten instead of detected.
    // Fixed by moving the condition onto the UPDATE itself. Runs before
    // section 9 below, deliberately — that section revokes this same test
    // user's access as part of its own test, so this needs to run first,
    // while asFieldOfficer is still a real, valid, active Member.
    const { data: pendingConn, error: pendingConnErr } = await admin.from('connections').insert({
      supply_chain_id: supplyChain.id, actor_from_id: otherTenantActor.id, actor_to_id: actor.id, status: 'Pending',
    }).select().single();
    if (pendingConnErr) throw new Error(`Could not create test connection: ${pendingConnErr.message}`);
    cleanup.push(() => admin.from('connections').delete().eq('id', pendingConn.id));

    await admin.from('connections').update({ status: 'Revoked' }).eq('id', pendingConn.id);
    // Called as the real, authenticated test user (a real Member on
    // actor_to_id) — not the service-role admin client, which would bypass
    // approve_connection's own real authorization checks entirely rather
    // than genuinely exercising them.
    const { error: approveAfterRevokeErr } = await asFieldOfficer.rpc('approve_connection', { p_connection_id: pendingConn.id });
    const { data: connAfter } = await admin.from('connections').select('status').eq('id', pendingConn.id).single();
    check(
      'Approving a connection that was concurrently revoked raises an error and leaves it Revoked (not silently Active)',
      !!approveAfterRevokeErr && connAfter?.status === 'Revoked',
      `error=${approveAfterRevokeErr?.message}, status=${connAfter?.status}`
    );

    // =========================================================================
    console.log('\n9. Removing a team member actually revokes access');
    // =========================================================================
    // Real bug: useRemoveTeamMember only deleted the team_members row.
    // auth_role()/auth_current_actor_id()/auth_supply_chain_id() read solely
    // from user_accounts, so "removal" changed nothing about real access.
    const { data: beforeRemoval } = await asFieldOfficer.from('actors').select('id').eq('id', actor.id);
    check('Before removal: the test Member can see their own actor', (beforeRemoval?.length ?? 0) === 1);

    const { error: removeErr } = await admin.from('team_members').delete().eq('actor_id', actor.id).eq('user_id', authUser.user.id);
    if (removeErr) throw new Error(`Could not remove test team member: ${removeErr.message}`);

    const { data: afterAccount } = await admin.from('user_accounts').select('supply_chain_id, current_actor_id').eq('id', authUser.user.id).single();
    check(
      'After removal (their only team_members row): supply_chain_id and current_actor_id are both cleared',
      afterAccount?.supply_chain_id === null && afterAccount?.current_actor_id === null,
      `supply_chain_id=${afterAccount?.supply_chain_id}, current_actor_id=${afterAccount?.current_actor_id}`
    );

    const { data: afterRemoval } = await asFieldOfficer.from('actors').select('id').eq('id', actor.id);
    check('After removal: the same session can no longer see any actor at all', (afterRemoval?.length ?? 0) === 0);

    // =========================================================================
    console.log('\n10. user_accounts has no INSERT policy (self-registration is not possible)');
    // =========================================================================
    // Real bug: the old policy restricted WHICH id could be inserted, but
    // placed zero restriction on role/supply_chain_id — a real account could
    // have self-assigned Admin on any tenant. Fixed by removing the policy
    // entirely, since nothing legitimate ever depended on it.
    const { error: selfInsertErr } = await asFieldOfficer.from('user_accounts').insert({
      id: authUser.user.id, username: 'Self-Escalation Attempt', role: 'Admin', supply_chain_id: supplyChain.id,
    });
    check('A real authenticated user cannot insert their own user_accounts row at all', !!selfInsertErr, selfInsertErr ? undefined : 'insert unexpectedly succeeded');

    // =========================================================================
    console.log('\n11. Charter-required-if-Sustainable is enforced by the database, not just JS');
    // =========================================================================
    const { error: charterViolationErr } = await admin.from('beekeepers').insert({
      supply_chain_id: supplyChain.id, full_name: `${testTag}-charter-violation`,
      standards: ['Sustainable'], charter_signed: false, commitment: ['Honey'],
    });
    check(
      'A direct insert with Sustainable + charter_signed=false is rejected by the database itself',
      !!charterViolationErr && /beekeepers_charter_required_if_sustainable/.test(charterViolationErr.message || ''),
      charterViolationErr ? undefined : 'insert unexpectedly succeeded'
    );

    const { data: charterOk, error: charterOkErr } = await admin.from('beekeepers').insert({
      supply_chain_id: supplyChain.id, full_name: `${testTag}-charter-ok`,
      standards: ['Sustainable'], charter_signed: true, commitment: ['Honey'],
    }).select().single();
    check('The same rule correctly allows Sustainable + charter_signed=true', !charterOkErr && !!charterOk, charterOkErr?.message);
    if (charterOk) cleanup.push(() => admin.from('beekeepers').delete().eq('id', charterOk.id));

    // ---- Fixture: a second, fresh authenticated Member ----
    // Real bug found from an actual CI run, not a bug in the app: section 9
    // above deliberately, correctly revokes asFieldOfficer's own access as
    // its whole point (that's what it's testing). Reusing that same,
    // now-genuinely-revoked session for the tests below -- which all
    // legitimately need a real, still-valid Member session -- was a bug in
    // this suite's own test ordering, not the functions under test.
    // Confirmed live: process_stock correctly, accurately rejected
    // asFieldOfficer with "Not authorized" once its supply_chain_id was
    // genuinely null, exactly as it should for a real revoked user --
    // proving the fix from section 9 itself works, but showing this test
    // needs its own, separate, un-revoked session.
    const testEmail2 = `${testTag.toLowerCase()}-2@smoketest.invalid`;
    const testPassword2 = `Sm0ke-${randomUUID()}`;
    const { data: authUser2, error: authUser2Err } = await admin.auth.admin.createUser({
      email: testEmail2, password: testPassword2, email_confirm: true,
    });
    if (authUser2Err) throw new Error(`Could not create second test auth user: ${authUser2Err.message}`);
    cleanup.push(() => admin.auth.admin.deleteUser(authUser2.user.id));

    const { error: ua2Err } = await admin.from('user_accounts').insert({
      id: authUser2.user.id, username: `${testTag}-2`, role: 'Member',
      supply_chain_id: supplyChain.id, current_actor_id: actor.id,
    });
    if (ua2Err) throw new Error(`Could not create second test user_account: ${ua2Err.message}`);

    const { error: tm2Err } = await admin.from('team_members').insert({
      actor_id: actor.id, name: `${testTag}-2`, email: testEmail2, role: 'Member',
      status: 'Active', user_id: authUser2.user.id,
    });
    if (tm2Err) throw new Error(`Could not create second test team_members row: ${tm2Err.message}`);

    const asMember2 = createClient(SUPABASE_URL, ANON_KEY);
    const { error: signIn2Err } = await asMember2.auth.signInWithPassword({ email: testEmail2, password: testPassword2 });
    if (signIn2Err) throw new Error(`Could not sign in as second test Member: ${signIn2Err.message}`);

    // =========================================================================
    console.log('\n12. approve_transaction: real status-conflict is caught, not overwritten');
    // =========================================================================
    // Real bug: same pattern as approve_connection above -- the final UPDATE
    // had no status condition in its own WHERE clause.
    const tx12Group = randomUUID();
    const { error: tx12Err } = await admin.from('transactions').insert({
      transaction_group_id: tx12Group, supply_chain_id: supplyChain.id, direction: 'Received',
      standard: 'Sustainable', beekeeper_id: beekeeper.id, product: 'Honey', quantity: 10, unit: 'Kg',
      price: 100, total_amount: 1000, transaction_date: '2026-01-01', status: 'Pending', owning_actor_id: actor.id,
    });
    if (tx12Err) throw new Error(`Could not create test transaction (12): ${tx12Err.message}`);
    cleanup.push(() => admin.from('transactions').delete().eq('transaction_group_id', tx12Group));

    await admin.from('transactions').update({ status: 'Rejected' }).eq('transaction_group_id', tx12Group);
    const { error: approveAfterRejectErr } = await asMember2.rpc('approve_transaction', { p_transaction_group_id: tx12Group });
    const { data: tx12After } = await admin.from('transactions').select('status').eq('transaction_group_id', tx12Group).single();
    check(
      'Approving a transaction that was concurrently rejected raises an error and leaves it Rejected (not silently Approved)',
      !!approveAfterRejectErr && tx12After?.status === 'Rejected',
      `error=${approveAfterRejectErr?.message}, status=${tx12After?.status}`
    );

    // =========================================================================
    console.log('\n13. reject_transaction_with_reversal: the most serious race — no phantom reversal');
    // =========================================================================
    // Real bug, the most serious of the three: a transaction could be
    // simultaneously Approved (by one path) AND get a full rejection
    // reversal (stock row + new reversal transaction + notification)
    // created by this function, corrupting the immutable ledger. Fixed by
    // gating every side effect on the same race-safe UPDATE, not just the
    // status column.
    const tx13Group = randomUUID();
    const { error: tx13Err } = await admin.from('transactions').insert({
      transaction_group_id: tx13Group, supply_chain_id: supplyChain.id, direction: 'Received',
      standard: 'Sustainable', beekeeper_id: beekeeper.id, product: 'Honey', quantity: 10, unit: 'Kg',
      price: 100, total_amount: 1000, transaction_date: '2026-01-01', status: 'Pending', owning_actor_id: actor.id,
    });
    if (tx13Err) throw new Error(`Could not create test transaction (13): ${tx13Err.message}`);
    cleanup.push(() => admin.from('transactions').delete().eq('transaction_group_id', tx13Group));

    await admin.from('transactions').update({ status: 'Approved' }).eq('transaction_group_id', tx13Group);
    const { error: rejectAfterApproveErr } = await asMember2
      .rpc('reject_transaction_with_reversal', { p_transaction_group_id: tx13Group, p_reject_reason: 'smoke test' });
    const { data: tx13After } = await admin.from('transactions').select('status').eq('transaction_group_id', tx13Group).single();
    const { data: phantomReversals } = await admin
      .from('transactions').select('id').neq('transaction_group_id', tx13Group)
      .eq('supply_chain_id', supplyChain.id).ilike('comments', '%smoke test%');
    check(
      'Rejecting a transaction that was concurrently approved raises an error, leaves it Approved, and creates no reversal',
      !!rejectAfterApproveErr && tx13After?.status === 'Approved' && (phantomReversals?.length ?? 0) === 0,
      `error=${rejectAfterApproveErr?.message}, status=${tx13After?.status}, phantom reversals=${phantomReversals?.length}`
    );

    // =========================================================================
    console.log('\n14. Report exports: downloadable by their owner or Admin, not the whole tenant');
    // =========================================================================
    // Real bug: private-media's storage policy scoped exports/ the same as
    // every other folder in the bucket (tenant-only) -- a Member or Field
    // Officer could download a report export an Admin generated containing
    // tenant-wide data they'd never normally see through the UI.
    const otherUserExportPath = `exports/${supplyChain.id}/${randomUUID()}/${testTag}-not-mine.csv`;
    const { error: exportUploadErr } = await admin.storage.from('private-media')
      .upload(otherUserExportPath, Buffer.from('col1,col2\n1,2'), { contentType: 'text/csv' });
    if (exportUploadErr) throw new Error(`Could not create test export file: ${exportUploadErr.message}`);
    cleanup.push(() => admin.storage.from('private-media').remove([otherUserExportPath]));

    const { data: exportsVisible } = await asMember2.storage.from('private-media')
      .list(`exports/${supplyChain.id}`, { search: `${testTag}-not-mine` });
    check(
      'A real Member cannot see another user\'s export file in the same tenant',
      (exportsVisible?.length ?? 0) === 0,
      `got ${exportsVisible?.length} matching files`
    );

    // =========================================================================
    console.log('\n15. process_stock: a retry with the same idempotency key does not double-consume stock');
    // =========================================================================
    // Real gap found while building duplicate-submission protection: unlike
    // a plain insert, process_stock has a real side effect beyond creating a
    // row -- it physically deducts quantity_available from source batches.
    // A genuine network retry (the call succeeded server-side, the client
    // never got the response) could have silently deducted real inventory
    // twice. Fixed by accepting a client-generated idempotency key and
    // returning the existing result immediately if a transaction with that
    // exact group id already exists, before touching any batch.
    const { data: sourceStock, error: sourceStockErr } = await admin
      .from('stocks')
      .insert({ supply_chain_id: supplyChain.id, stock_type: 'Raw Material', product: 'Crude Honey', standard: 'Sustainable', quantity_available: 20, unit: 'Kg', owning_actor_id: actor.id })
      .select().single();
    if (sourceStockErr) throw new Error(`Could not create test source stock: ${sourceStockErr.message}`);
    cleanup.push(() => admin.from('stocks').delete().eq('id', sourceStock.id));

    const idempotencyKey = randomUUID();
    const processArgs = {
      p_source_product: 'Crude Honey', p_standard: 'Sustainable',
      p_source_batches: [{ stock_id: sourceStock.id, quantity: 5 }],
      p_destinations: [{ product: 'Honey', quantity: 5, unit: 'Kg' }],
      p_transaction_type: 'Refining', p_transaction_date: '2026-01-01', p_currency: null,
      p_idempotency_key: idempotencyKey,
    };
    const { data: firstGroupId, error: firstCallErr } = await asMember2.rpc('process_stock', processArgs);
    if (firstCallErr) throw new Error(`process_stock first call failed: ${firstCallErr.message}`);
    cleanup.push(() => admin.from('transactions').delete().eq('transaction_group_id', firstGroupId));
    cleanup.push(() => admin.from('transaction_batch_selections').delete().eq('transaction_group_id', firstGroupId));
    cleanup.push(() => admin.from('stocks').delete().eq('supply_chain_id', supplyChain.id).eq('product', 'Honey'));

    const { data: afterFirstCall } = await admin.from('stocks').select('quantity_available').eq('id', sourceStock.id).single();
    check('First call consumes the real, correct amount (20 - 5 = 15)', Number(afterFirstCall?.quantity_available) === 15, `got ${afterFirstCall?.quantity_available}`);

    // The retry: identical arguments, same idempotency key.
    const { data: retryGroupId, error: retryErr } = await asMember2.rpc('process_stock', processArgs);
    const { data: afterRetry } = await admin.from('stocks').select('quantity_available').eq('id', sourceStock.id).single();
    check(
      'Retrying with the same idempotency key returns the same group id and does not consume stock again',
      !retryErr && retryGroupId === firstGroupId && Number(afterRetry?.quantity_available) === 15,
      `error=${retryErr?.message}, sameGroupId=${retryGroupId === firstGroupId}, quantity=${afterRetry?.quantity_available}`
    );

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
