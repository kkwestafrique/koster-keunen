-- Found while building the "add delivery" action: contract_delivery_
-- notifications_insert only checked supply_chain_id, with no role
-- restriction at all -- inconsistent with this table's own UPDATE policy,
-- which correctly restricts to Admin/Member. Aligning INSERT to match,
-- same restriction the new "add delivery" UI is gated by client-side
-- (canEdit), so both layers agree.
--
-- Verified directly: a Field Officer session was confirmed blocked
-- ("new row violates row-level security policy"), and an Admin session
-- was confirmed to succeed, in a rolled-back test transaction.
drop policy if exists contract_delivery_notifications_insert on public.contract_delivery_notifications;
create policy contract_delivery_notifications_insert on public.contract_delivery_notifications
  for insert
  with check (
    (not public.auth_acting_actor_disabled())
    and supply_chain_id = public.auth_supply_chain_id()
    and public.auth_role() = any (array['Admin'::text, 'Member'::text])
  );
