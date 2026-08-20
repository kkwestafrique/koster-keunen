-- Gap 19 (Low): Field Officer's export capability had no role
-- restriction. exports_insert only checked supply_chain_id -- same
-- pattern already found and fixed twice this session
-- (contract_delivery_notifications_insert, and the invite Edge
-- Function's rate limiting): UPDATE/DELETE on this table were already
-- correctly restricted to Admin/Member, but INSERT -- the actual
-- trigger for creating a real export -- was not, letting any
-- authenticated user (Field Officer included) generate one.
--
-- Note: a Field Officer exporting only ever surfaces data they can
-- already see through the normal UI (RLS scopes both equally) -- this
-- isn't a data leak, just an inconsistency with how every other similar
-- action in this app is gated. Fixing it for consistency, per the
-- audit finding.
--
-- Verified directly: a Field Officer session was confirmed blocked
-- ("new row violates row-level security policy"), and an Admin session
-- was confirmed to succeed, in a rolled-back test transaction.
drop policy if exists exports_insert on public.exports;
create policy exports_insert on public.exports
  for insert
  with check (
    (not public.auth_acting_actor_disabled())
    and supply_chain_id = public.auth_supply_chain_id()
    and public.auth_role() = any (array['Admin'::text, 'Member'::text])
  );
