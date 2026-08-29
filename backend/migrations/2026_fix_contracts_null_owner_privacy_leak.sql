-- Real privacy bug found via direct testing feedback and confirmed
-- against live data: contracts_select's "owning_actor_id is null"
-- clause was unconditional -- any authenticated user in the supply
-- chain could see any contract with no owner set, regardless of
-- whether they were the counterparty or had any relationship to it at
-- all. Confirmed directly: two real contracts (NQQ76O0IP4,
-- 0LJS1WIODY) with owning_actor_id = null were visible to Nigeria
-- association despite having nothing to do with them.
--
-- This was a real oversight introduced when extending contracts_select
-- for counterparty visibility earlier today -- the equivalent NULL-
-- owner clause on other tables (e.g. beekeepers_select) is correctly
-- gated to Admin role only, and this one wasn't. Fixed to match that
-- same, already-established pattern.
--
-- Verified with three real checks, not assumed: Babs's own real Admin
-- account still sees both unowned contracts (expected, unchanged --
-- Admin visibility into unclaimed/unowned records is the same
-- legitimate pattern used elsewhere, e.g. an unclaimed-data queue for
-- admins to manage); a real Member-level account is now correctly
-- blocked (returns zero rows, confirming the actual leak is closed);
-- and Nigeria association's own real, legitimate contracts (8 total,
-- as owner or counterparty) remain fully visible, confirming no
-- regression to normal access.
drop policy if exists contracts_select on public.contracts;
create policy contracts_select on public.contracts
  for select
  using (
    (
      supply_chain_id = public.auth_supply_chain_id()
      and (
        owning_actor_id = public.auth_current_actor_id()
        or (owning_actor_id is null and public.auth_role() = 'Admin')
        or actor_id = public.auth_current_actor_id()
      )
    )
    or public.has_permission(supply_chain_id, 'contracts', 'View')
  );
