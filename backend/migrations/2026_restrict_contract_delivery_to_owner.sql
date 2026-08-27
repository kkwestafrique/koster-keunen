-- Confirmed with Babs: only a contract's owner (the actor who created
-- it) should be able to log a delivery against it, matching how
-- contract editing already works. The real mechanism for the
-- counterparty to confirm or dispute what actually arrived is the
-- Transactions module (Receive Stock's own two-sided approval flow),
-- not writing directly into someone else's contract delivery log --
-- letting both parties log independently into the same list risked
-- two conflicting entries for the same real-world delivery with no way
-- to reconcile them.
--
-- Verified end to end: as the real Wax Aggregator account (the
-- counterparty on a real contract, not its owner), an insert attempt
-- was confirmed blocked. Temporarily switched the same real account's
-- current_actor_id to Amina Yusuf (the actual owner) and confirmed the
-- identical insert succeeds -- then restored current_actor_id back to
-- its real original value and confirmed the restoration.
drop policy if exists contract_delivery_notifications_insert on public.contract_delivery_notifications;
create policy contract_delivery_notifications_insert on public.contract_delivery_notifications
  for insert
  with check (
    (not public.auth_acting_actor_disabled())
    and supply_chain_id = public.auth_supply_chain_id()
    and public.auth_role() = any (array['Admin'::text, 'Member'::text])
    and exists (
      select 1 from public.contracts c
      where c.contract_group_id = contract_delivery_notifications.contract_group_id
        and c.owning_actor_id = public.auth_current_actor_id()
    )
  );
