-- Real bug found via independent audit: "Activity log duplicate rows".
-- Confirmed directly against live data: both contracts and transactions
-- store one row per product line, sharing a single contract_group_id/
-- transaction_group_id -- a real multi-product contract or transaction
-- genuinely has multiple rows in the raw table. This view was built
-- selecting directly from those raw tables, one row per line, so a
-- single real creation event (e.g. a 3-product contract) appeared as 3
-- separate, identical-looking entries in the Activity Log -- looking
-- exactly like duplicates, even though each entity_id was technically
-- distinct. Same root pattern as the transaction_groups list-display
-- bug fixed earlier this session (BUG-01 audit item), just showing up
-- in a different view. Fixed by grouping both to one row per real
-- logical record, matching the same aggregation already used in
-- contract_groups/transaction_groups.
--
-- Verified directly against live data: a real 2-line contract
-- (3dd5072a...) and a real 2-line transaction (3e14cd75...) both now
-- correctly appear exactly once in activity_log, not twice.
-- security_invoker = true re-confirmed still correctly scoping RLS
-- after the rewrite (100 rows for a real scoped session vs 124
-- unrestricted).
create or replace view public.activity_log
with (security_invoker = true) as
  select 'Actor'::text as entity_type, actors.id as entity_id, actors.contact_name as entity_label,
    actors.created_by, actors.created_at, actors.updated_by, actors.updated_at, actors.supply_chain_id
  from actors
  union all
  select 'Beekeeper'::text, beekeepers.id, beekeepers.full_name,
    beekeepers.created_by, beekeepers.created_at, beekeepers.updated_by, beekeepers.updated_at, beekeepers.supply_chain_id
  from beekeepers
  union all
  select 'Contract'::text, contracts.contract_group_id, min(contracts.contract_code),
    (array_agg(contracts.created_by order by contracts.created_at))[1],
    min(contracts.created_at),
    (array_agg(contracts.updated_by order by contracts.updated_at desc nulls last))[1],
    max(contracts.updated_at),
    contracts.supply_chain_id
  from contracts
  group by contracts.contract_group_id, contracts.supply_chain_id
  union all
  select 'Stock'::text, stocks.id, stocks.product || coalesce(' — '::text || stocks.batch_reference, ''::text),
    stocks.created_by, stocks.created_at, stocks.updated_by, stocks.updated_at, stocks.supply_chain_id
  from stocks
  union all
  select 'Transaction'::text, transactions.transaction_group_id, min(transactions.transaction_code),
    (array_agg(transactions.logged_by order by transactions.created_at))[1],
    min(transactions.created_at),
    (array_agg(transactions.updated_by order by transactions.updated_at desc nulls last))[1],
    max(transactions.updated_at),
    transactions.supply_chain_id
  from transactions
  group by transactions.transaction_group_id, transactions.supply_chain_id
  union all
  select 'Claim'::text, claims.id, (claims.standard || ' ('::text) || claims.entity_type || ')'::text,
    claims.submitted_by, claims.submitted_at, claims.verified_by, coalesce(claims.verified_at, claims.submitted_at), claims.supply_chain_id
  from claims;
