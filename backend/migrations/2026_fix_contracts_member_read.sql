-- SUPERSEDED — the original version of this file (a too-broad fix) was
-- reviewed and replaced. See explanation below, then the corrected policy
-- that's ACTUALLY applied live in Supabase right now.
--
-- The original diagnosis in this file was CORRECT: Member/Field Officer
-- saw 0 rows from `contracts` even for real, existing data. Root cause,
-- confirmed: all 4 real contracts in this project predate the
-- `owning_actor_id` column/trigger (added later in the same larger
-- session that built actor-level isolation for Beekeepers/Contracts/
-- Transactions), so they all have `owning_actor_id = null`. The existing
-- `contracts_select` policy only made null-owner rows visible to Admin
-- (`owning_actor_id is null and auth_role() = 'Admin'`) — Member/Field
-- Officer had no equivalent carve-out, hence 0 rows.
--
-- The FIX in this file's original version was too broad: it added
-- `supply_chain_id = auth_supply_chain_id()` as a second, independent
-- permissive SELECT policy. Since Postgres OR's multiple permissive
-- policies for the same command together, this didn't just patch the
-- null-owner case — it gave every Member/Field Officer full company-wide
-- visibility into EVERY contract regardless of actor, silently undoing
-- the actor-isolation wall this table was deliberately built with
-- earlier in the same project (and which is still correctly enforced on
-- Beekeepers and Transactions). This was caught by re-reviewing the
-- actual live policy state, not assumed.
--
-- Corrected fix: null-owner (unassigned/legacy) contracts become visible
-- to EVERYONE in the supply chain, not just Admin — since nobody actually
-- owns them yet, there's no specific person's wall to respect, and this
-- doesn't require guessing at real ownership data for the legacy rows.
-- Assigned contracts remain properly actor-scoped for everyone, Admin
-- included, exactly as originally built and tested. Verified directly:
-- a Member now sees the 4 legacy contracts, but is still correctly
-- blocked from a contract explicitly assigned to a DIFFERENT actor.
drop policy if exists contracts_select_same_supply_chain on public.contracts;
drop policy if exists contracts_select on public.contracts;

create policy contracts_select on public.contracts for select
  using (
    (supply_chain_id = auth_supply_chain_id() and (owning_actor_id = auth_current_actor_id() or owning_actor_id is null))
    or has_permission(supply_chain_id, 'contracts', 'View')
  );
