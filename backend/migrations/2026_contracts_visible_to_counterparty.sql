-- Real bug, confirmed and reproduced exactly against live data: a
-- contract's SELECT policy only ever checked owning_actor_id, never
-- actor_id (the counterparty named on the contract). A "Send" contract
-- from Amina Yusuf to Wax Aggregator was completely invisible to Wax
-- Aggregator's own account -- confirmed directly, querying as that
-- real actor returned zero rows for 3 real contracts naming them.
-- Matches "Contract was sent to Wax Agg but not showing" exactly.
--
-- Unlike Send Stock (which needed a genuinely separate linked
-- transaction row, since stock needs independent effects and approval
-- on each side), a contract is one shared agreement -- both named
-- parties should see the same row, not a duplicate. Only extending
-- SELECT here; UPDATE/DELETE/INSERT stay exactly as they were,
-- restricted to owning_actor_id only, confirmed unchanged -- the
-- counterparty gets read visibility into what was agreed, not edit
-- rights over a contract they didn't create.
--
-- Verified end to end: querying as the real Wax Aggregator account
-- before this fix returned zero rows for 3 real contracts naming them;
-- after, all 3 correctly returned. A follow-up UPDATE attempt as that
-- same account was confirmed silently blocked (RLS UPDATE policies
-- fail silently rather than raising an exception -- verified by
-- checking the actual stored value was unchanged, not just the absence
-- of an error).
drop policy if exists contracts_select on public.contracts;
create policy contracts_select on public.contracts
  for select
  using (
    (
      supply_chain_id = public.auth_supply_chain_id()
      and (
        owning_actor_id = public.auth_current_actor_id()
        or owning_actor_id is null
        or actor_id = public.auth_current_actor_id()
      )
    )
    or public.has_permission(supply_chain_id, 'contracts', 'View')
  );
