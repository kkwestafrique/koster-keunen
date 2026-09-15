-- Real race conditions found via security audit (Section 20:
-- concurrency). All three functions shared the same bug pattern: an
-- earlier read-and-check ("if status <> 'Pending' then raise
-- exception"), followed by a final UPDATE with no status condition at
-- all in its own WHERE clause. If the row's status changed between
-- that earlier check and this function's own UPDATE -- e.g. a
-- concurrent request revoking a connection, or approving a transaction
-- that a second request is simultaneously trying to reject -- the
-- UPDATE would still blindly apply, silently overwriting the
-- concurrent change instead of detecting it. For
-- reject_transaction_with_reversal specifically, this could mean a
-- transaction ending up 'Approved' while a full rejection reversal
-- (a returned stock row, a new reversal transaction, and a
-- notification) had already been created for it -- corrupting the
-- ledger this app is specifically built to keep trustworthy and
-- immutable.
--
-- Fixed identically in all three: the status condition moved onto the
-- UPDATE itself (making the check-and-act atomic, not two separate
-- steps), with the real row count checked via GET DIAGNOSTICS
-- afterward. If nothing matched, the row's status genuinely changed
-- underneath this call, and that's now a real, distinct error instead
-- of a silent, incorrect overwrite. For reject_transaction_with_reversal,
-- this check happens before any of the reversal side effects, so a
-- detected race aborts the whole function before creating any of them.
--
-- Verified live for all three, each in a rolled-back transaction:
-- - approve_connection: happy path still works; simulated the exact
--   race (read sees Pending, concurrent revoke happens, then the fixed
--   conditional update runs) and confirmed the row stays Revoked, not
--   silently overwritten back to Active.
-- - approve_transaction / reject_transaction_with_reversal: confirmed
--   a transaction concurrently approved can no longer be rejected with
--   a reversal created on top of it -- the fixed function now raises a
--   real error, and confirmed directly that no new reversal stock row
--   was created and the transaction's real status was untouched.

create or replace function public.approve_connection(p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_conn record;
  v_caller_role text;
  v_caller_supply_chain_id uuid;
  v_rows_updated int;
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
  update public.connections set status = 'Active'
    where id = p_connection_id and status = 'Pending';
  get diagnostics v_rows_updated = row_count;
  perform set_config('app.connection_approval_in_progress', 'false', true);

  if v_rows_updated = 0 then
    raise exception 'This connection was changed by someone else just now -- please refresh and try again';
  end if;

  insert into public.notifications (supply_chain_id, actor_id, type, title, message, link)
  select v_conn.supply_chain_id, v_conn.actor_from_id, 'connection_approved',
    'Your connection request was approved',
    a.contact_name || ' approved your connection request',
    '/connections'
  from public.actors a where a.id = v_conn.actor_to_id;
end;
$function$;

create or replace function public.approve_transaction(p_transaction_group_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tx record;
  v_caller_role text;
  v_caller_supply_chain_id uuid;
  v_rows_updated int;
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

  update public.transactions set status = 'Approved'
    where transaction_group_id = p_transaction_group_id and status = 'Pending';
  get diagnostics v_rows_updated = row_count;

  if v_rows_updated = 0 then
    raise exception 'This transaction was changed by someone else just now -- please refresh and try again';
  end if;
end;
$function$;

create or replace function public.reject_transaction_with_reversal(p_transaction_group_id uuid, p_reject_reason text DEFAULT NULL::text, p_reject_comment text DEFAULT NULL::text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_tx record;
  v_send_group_id uuid;
  v_send record;
  v_total_quantity numeric;
  v_returned_stock_id uuid;
  v_returned_group_id uuid;
  v_caller_role text;
  v_caller_supply_chain_id uuid;
  v_rows_updated int;
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
  where transaction_group_id = p_transaction_group_id and status = 'Pending';
  get diagnostics v_rows_updated = row_count;

  if v_rows_updated = 0 then
    raise exception 'This transaction was changed by someone else just now -- please refresh and try again';
  end if;

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
