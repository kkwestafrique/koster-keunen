-- Fix: Member/Field Officer roles get ZERO rows back from `contracts` (and
-- therefore the `contract_groups` view, which just re-runs the query under
-- the caller's own RLS) even though the Contracts list is meant to be a
-- company-wide, supply-chain-scoped view — exactly like `actors` and
-- `beekeepers`, which only ever check `supply_chain_id = auth_supply_chain_id()`
-- with no extra role restriction.
--
-- Confirmed directly against the live project: a real signed-in session as
-- kkwestafrique@gmail.com (Admin) sees the 2 real contract_groups rows for
-- supply_chain 11111111-1111-1111-1111-111111111111; the exact same query
-- signed in as member.test@beeztrace.test (Member, Active team_members on
-- Amina Yusuf) returns 0 rows for the identical data. Since neither of
-- those 2 contracts even has Amina Yusuf as their actor_id, whatever the
-- existing policy is currently keying off, it is not "the contract belongs
-- to your actor" (that would ALSO returns 0 for Admin) — it is most likely
-- an Admin-only role check that Member/Field Officer simply never satisfy.
--
-- Postgres RLS policies for the same command are OR'd together (unless
-- explicitly declared RESTRICTIVE, which none of this project's existing
-- policies are), so adding this as an ADDITIONAL permissive SELECT policy
-- only ever expands visibility -- it cannot remove access Admin already
-- has, and it brings Member/Field Officer up to the same supply-chain-wide
-- read scope as every other entity table in this schema.
create policy contracts_select_same_supply_chain
  on public.contracts
  for select
  using (supply_chain_id = auth_supply_chain_id());
