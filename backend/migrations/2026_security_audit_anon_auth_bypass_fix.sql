-- Security audit remediation (2026-09-12)
--
-- Finding 1 (CRITICAL, confirmed live): approve_connection, approve_transaction,
-- attach_transaction_file, reject_claim, reject_transaction_with_reversal and
-- verify_claim are SECURITY DEFINER functions, EXECUTE-granted to anon and
-- authenticated (callable over plain /rest/v1/rpc/... with no session at all).
-- Every one of them resolves the caller's role/supply_chain_id from
-- user_accounts via auth.uid(), then gates on comparisons like
-- `if v_caller_role not in ('Admin','Member') then raise exception ...`.
-- For an unauthenticated (anon) caller, auth.uid() is NULL, so v_caller_role
-- and v_caller_supply_chain_id are NULL, and EVERY one of those comparisons
-- (<>, NOT IN, =) evaluates to NULL rather than TRUE -- and PL/pgSQL treats a
-- NULL IF-condition as false, so none of the "not authorized" branches ever
-- fire. Confirmed live via rollback-wrapped tests against real rows:
-- `SET LOCAL ROLE anon; SELECT approve_transaction(<real pending id>)` and
-- `SELECT approve_connection(<real pending id>)` both completed with no
-- exception and actually flipped status to Approved / Active in-transaction
-- (verified via RESET ROLE before reading back, then rolled back -- no
-- production data was changed by the test itself).
--
-- Fix: add an explicit "IS NULL" authentication guard immediately after the
-- caller lookup in each function, before any comparison that silently goes
-- NULL for an unauthenticated caller. create_grant already had exactly this
-- guard ("if v_caller_role is null then raise exception 'Not authenticated'")
-- -- these six functions are brought in line with that existing pattern.

CREATE OR REPLACE FUNCTION public.approve_connection(p_connection_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_conn record;
  v_caller_role text;
  v_caller_supply_chain_id uuid;
begin
  select role, supply_chain_id into v_caller_role, v_caller_supply_chain_id
  from public.user_accounts where id = auth.uid();

  if v_caller_role is null or v_caller_supply_chain_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_conn from public.connections where id = p_connection_id;
  if v_conn is null then
    raise exception 'Connection not found';
  end if;
  if v_conn.supply_chain_id <> v_caller_supply_chain_id then
    raise exception 'Not authorized to approve this connection';
  end if;
  if v_caller_role not in ('Admin', 'Member') then
    raise exception 'Not authorized to approve this connection';
  end if;
  if v_caller_role <> 'Admin' and v_conn.actor_to_id <> auth_member_actor_id() then
    raise exception 'Not authorized to approve this connection';
  end if;
  if v_caller_role = 'Admin' and auth_current_actor_id() <> v_conn.actor_to_id then
    raise exception 'Not authorized to approve this connection';
  end if;
  if v_conn.status <> 'Pending' then
    raise exception 'Only pending connections can be approved';
  end if;

  perform set_config('app.connection_approval_in_progress', 'true', true);
  update public.connections set status = 'Active' where id = p_connection_id;
  perform set_config('app.connection_approval_in_progress', 'false', true);

  insert into public.notifications (supply_chain_id, actor_id, type, title, message, link)
  select v_conn.supply_chain_id, v_conn.actor_from_id, 'connection_approved',
    'Your connection request was approved',
    a.contact_name || ' approved your connection request',
    '/connections'
  from public.actors a where a.id = v_conn.actor_to_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.approve_transaction(p_transaction_group_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tx record;
  v_caller_role text;
  v_caller_supply_chain_id uuid;
begin
  select role, supply_chain_id into v_caller_role, v_caller_supply_chain_id
  from public.user_accounts where id = auth.uid();

  if v_caller_role is null or v_caller_supply_chain_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_tx from public.transactions
  where transaction_group_id = p_transaction_group_id limit 1;

  if v_tx is null then
    raise exception 'Transaction not found';
  end if;
  if v_tx.supply_chain_id <> v_caller_supply_chain_id then
    raise exception 'Not authorized to approve this transaction';
  end if;
  if v_caller_role not in ('Admin', 'Member') then
    raise exception 'Not authorized to approve this transaction';
  end if;
  if v_caller_role <> 'Admin' and v_tx.owning_actor_id <> auth_member_actor_id() then
    raise exception 'Not authorized to approve this transaction';
  end if;
  if v_tx.status <> 'Pending' then
    raise exception 'Only pending transactions can be approved';
  end if;

  update public.transactions set status = 'Approved' where transaction_group_id = p_transaction_group_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.attach_transaction_file(p_transaction_group_id uuid, p_attachment_url text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tx record;
  v_caller_role text;
  v_caller_supply_chain_id uuid;
begin
  select role, supply_chain_id into v_caller_role, v_caller_supply_chain_id
  from public.user_accounts where id = auth.uid();

  if v_caller_role is null or v_caller_supply_chain_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_tx from public.transactions
  where transaction_group_id = p_transaction_group_id limit 1;

  if v_tx is null then
    raise exception 'Transaction not found';
  end if;
  if v_tx.supply_chain_id <> v_caller_supply_chain_id then
    raise exception 'Not authorized to attach a file to this transaction';
  end if;
  if v_caller_role not in ('Admin', 'Member') then
    raise exception 'Not authorized to attach a file to this transaction';
  end if;
  if v_caller_role <> 'Admin' and v_tx.owning_actor_id <> auth_member_actor_id() then
    raise exception 'Not authorized to attach a file to this transaction';
  end if;

  update public.transactions set attachment_url = p_attachment_url where transaction_group_id = p_transaction_group_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.reject_claim(p_claim_id uuid, p_reason text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_claim record;
  v_caller_role text;
  v_caller_supply_chain_id uuid;
begin
  select role, supply_chain_id into v_caller_role, v_caller_supply_chain_id
  from public.user_accounts where id = auth.uid();

  if v_caller_role is null or v_caller_supply_chain_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_claim from public.claims where id = p_claim_id;
  if v_claim is null then
    raise exception 'Claim not found';
  end if;
  if v_claim.supply_chain_id <> v_caller_supply_chain_id then
    raise exception 'Not authorized to reject this claim';
  end if;
  if v_caller_role not in ('Admin', 'Member') then
    raise exception 'Not authorized to reject this claim';
  end if;
  if v_claim.status <> 'Pending' then
    raise exception 'Only pending claims can be rejected';
  end if;

  update public.claims
  set status = 'Rejected', verified_by = auth.uid(), verified_at = now(), rejection_reason = p_reason
  where id = p_claim_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.verify_claim(p_claim_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_claim record;
  v_caller_role text;
  v_caller_supply_chain_id uuid;
begin
  select role, supply_chain_id into v_caller_role, v_caller_supply_chain_id
  from public.user_accounts where id = auth.uid();

  if v_caller_role is null or v_caller_supply_chain_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_claim from public.claims where id = p_claim_id;
  if v_claim is null then
    raise exception 'Claim not found';
  end if;
  if v_claim.supply_chain_id <> v_caller_supply_chain_id then
    raise exception 'Not authorized to verify this claim';
  end if;
  if v_caller_role not in ('Admin', 'Member') then
    raise exception 'Not authorized to verify this claim';
  end if;
  if v_claim.status <> 'Pending' then
    raise exception 'Only pending claims can be verified';
  end if;
  if v_claim.submitted_by = auth.uid() then
    raise exception 'You cannot verify a claim you submitted yourself';
  end if;

  update public.claims
  set status = 'Verified', verified_by = auth.uid(), verified_at = now()
  where id = p_claim_id;

  perform set_config('app.allow_standards_update', 'true', true);

  if v_claim.entity_type = 'beekeeper' then
    update public.beekeepers
    set standards = array_append(coalesce(standards, '{}'), v_claim.standard)
    where id = v_claim.entity_id and not (v_claim.standard = any(coalesce(standards, '{}')));
  else
    update public.actors
    set standards = array_append(coalesce(standards, '{}'), v_claim.standard)
    where id = v_claim.entity_id and not (v_claim.standard = any(coalesce(standards, '{}')));
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION public.reject_transaction_with_reversal(p_transaction_group_id uuid, p_reject_reason text DEFAULT NULL::text, p_reject_comment text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_tx record;
  v_send_group_id uuid;
  v_send record;
  v_total_quantity numeric;
  v_returned_stock_id uuid;
  v_returned_group_id uuid;
  v_caller_role text;
  v_caller_supply_chain_id uuid;
begin
  select role, supply_chain_id into v_caller_role, v_caller_supply_chain_id
  from public.user_accounts where id = auth.uid();

  if v_caller_role is null or v_caller_supply_chain_id is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_tx from public.transactions
  where transaction_group_id = p_transaction_group_id limit 1;

  if v_tx is null then
    raise exception 'Transaction not found';
  end if;
  if v_tx.direction <> 'Received' then
    raise exception 'Only Received transactions can be rejected';
  end if;
  if v_tx.supply_chain_id <> v_caller_supply_chain_id then
    raise exception 'Not authorized to reject this transaction';
  end if;
  if v_caller_role not in ('Admin', 'Member') then
    raise exception 'Not authorized to reject this transaction';
  end if;
  if v_caller_role <> 'Admin' and v_tx.owning_actor_id <> auth_member_actor_id() then
    raise exception 'Not authorized to reject this transaction';
  end if;
  if v_tx.status <> 'Pending' then
    raise exception 'Only pending transactions can be rejected';
  end if;

  update public.transactions
  set status = 'Rejected', reject_reason = p_reject_reason, reject_comment = p_reject_comment
  where transaction_group_id = p_transaction_group_id;

  v_send_group_id := v_tx.linked_transaction_group_id;
  if v_send_group_id is null then
    return;
  end if;

  select * into v_send from public.transactions where transaction_group_id = v_send_group_id limit 1;
  if v_send is null then
    return;
  end if;

  select coalesce(sum(quantity), 0) into v_total_quantity
  from public.transactions where transaction_group_id = v_send_group_id;

  insert into public.stocks (supply_chain_id, stock_type, product, standard, batch_reference, quantity_available, unit, owning_actor_id)
  values (
    v_send.supply_chain_id, 'Final Product', v_send.product, v_send.standard,
    'Returned -- rejected by receiving actor',
    v_total_quantity, coalesce(v_send.unit, 'Kg'), v_send.owning_actor_id
  )
  returning id into v_returned_stock_id;

  v_returned_group_id := gen_random_uuid();

  insert into public.transactions (
    transaction_group_id, supply_chain_id, direction, standard, owning_actor_id, actor_id,
    product, quantity, unit, total_amount, currency, transaction_date, status,
    linked_transaction_group_id, destination_stock_id
  ) values (
    v_returned_group_id, v_send.supply_chain_id, 'Received', v_send.standard, v_send.owning_actor_id, v_tx.owning_actor_id,
    v_send.product, v_total_quantity, v_send.unit, v_send.total_amount, v_send.currency, current_date, 'Returned',
    v_send_group_id, v_returned_stock_id
  );

  insert into public.notifications (supply_chain_id, actor_id, type, title, message, link)
  values (
    v_send.supply_chain_id, v_send.owning_actor_id, 'transaction_rejected',
    'Your shipment was rejected',
    v_total_quantity || ' ' || coalesce(v_send.unit, 'Kg') || ' of ' || v_send.product
      || coalesce(' -- ' || p_reject_reason, ''),
    '/transactions/received'
  );
end;
$function$;

-- Finding 2 (CRITICAL, confirmed live): get_user_id_by_email(text) has NO
-- authentication guard at all and is EXECUTE-granted to anon -- literally
-- anyone on the public internet can POST /rest/v1/rpc/get_user_id_by_email
-- with any email address and get back that person's real internal
-- auth.users UUID (confirmed live against a real account: returned the
-- correct user id for kkwestafrique@gmail.com with zero authentication).
-- It IS legitimately used, but only server-side, from the invite-team-member
-- Edge Function's service-role client -- never from the browser. Fix:
-- revoke EXECUTE from anon/authenticated; service_role is unaffected (it
-- isn't covered by these grants and Supabase's service key bypasses them).
--
-- lookup_user_by_email(text) is the same shape (SECURITY DEFINER, zero auth
-- guard, anon-executable) and is not referenced anywhere in the app or edge
-- functions -- confirmed via full-repo search. Revoked the same way rather
-- than left as unused public attack surface.
REVOKE EXECUTE ON FUNCTION public.get_user_id_by_email(text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.lookup_user_by_email(text) FROM anon, authenticated;

-- Finding 3 (LOW/defense-in-depth): lookup_actor_by_connect_id(text) has no
-- authentication guard either and returns actor PII (contact_name, email,
-- phone, location) to anon. Practical risk is low -- connect_id is a
-- 15-character random lowercase string (26^15 possibilities, unguessable by
-- brute force) -- but the only real caller (ActorFormDialog's "connect to an
-- existing actor" flow) only ever runs after login, so requiring
-- authentication costs nothing and removes anonymous PII-lookup-by-guessed-
-- or-leaked-code as an avenue entirely.
CREATE OR REPLACE FUNCTION public.lookup_actor_by_connect_id(p_connect_id text)
 RETURNS TABLE(id uuid, contact_name text, actor_type text, country text, state_region text, lga_municipality text, village text, contact_email text, contact_phone text, standards text[], connect_id text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id, contact_name, actor_type, country, state_region, lga_municipality,
         village, contact_email, contact_phone, standards, connect_id
  from public.actors
  where connect_id = p_connect_id
    and auth.uid() is not null
  limit 1;
$function$;

-- Finding 4 (HIGH, confirmed live): the user_accounts_self_update RLS
-- policy lets any authenticated user PATCH their own user_accounts row via
-- plain PostgREST (no RPC) and set current_actor_id to ANY actor id in the
-- system -- including actors in their own supply chain they have no
-- team_members row for at all. This completely bypasses
-- switch_current_actor()'s real membership check (which the app's UI always
-- goes through, but the database does not enforce independently). Once
-- current_actor_id is hijacked this way, every RLS policy keyed on
-- `owning_actor_id = auth_current_actor_id()` -- stocks, contracts,
-- beekeepers, transactions, notifications -- treats the caller as that
-- other actor. For Member/Admin callers this grants full read+write over an
-- unconnected actor's business data; for every role it grants read access
-- to another actor's private transactions, contracts and stocks.
-- Confirmed live: as a real Field Officer (team member of exactly one
-- actor), a direct UPDATE of user_accounts.current_actor_id to a second,
-- unrelated actor in the same tenant was accepted by RLS (rolled back
-- immediately after, no lasting change).
-- Fix: pin current_actor_id to its existing value in the self-update
-- policy's WITH CHECK, the same way `role` is already pinned there -- any
-- legitimate actor switch must go through switch_current_actor(), which
-- re-validates team membership; direct table writes can no longer change it.
ALTER POLICY user_accounts_self_update ON public.user_accounts
  WITH CHECK (
    (id = auth.uid())
    AND (role = (SELECT user_accounts_1.role FROM public.user_accounts user_accounts_1 WHERE user_accounts_1.id = auth.uid()))
    AND (current_actor_id IS NOT DISTINCT FROM (SELECT user_accounts_1.current_actor_id FROM public.user_accounts user_accounts_1 WHERE user_accounts_1.id = auth.uid()))
  );
