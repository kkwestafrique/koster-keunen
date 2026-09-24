-- Fixes: clicking a "New stock received" or "Your shipment was
-- rejected" notification leads to a 404 page.
--
-- Root cause: both notification-creating functions hardcode
-- link = '/transactions/received', but that route has never actually
-- existed in the frontend router -- the real route for that list is
-- '/transactions' itself, with direction="Received" passed as a
-- component prop, not part of the URL (App.js has a comment saying
-- exactly this). '/transactions/received/new' does exist (the Receive
-- Stock form), which is presumably how this wrong value got copied
-- into the wrong place across several migrations over time.
--
-- This affects the majority of all notifications ever created (15 of
-- 24 real rows, both transaction_pending and transaction_rejected)
-- and every future one from these two functions, so this migration
-- also updates the existing rows -- fixing only the function would
-- leave every already-sent notification still leading to a 404.

CREATE OR REPLACE FUNCTION public.create_linked_received_for_send()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_linked_group_id uuid;
begin
  if NEW.direction <> 'Send' then
    return NEW;
  end if;

  v_linked_group_id := gen_random_uuid();

  update public.transactions set linked_transaction_group_id = v_linked_group_id
  where transaction_group_id = NEW.transaction_group_id;

  insert into public.transactions (
    transaction_group_id, supply_chain_id, direction, standard, actor_id, owning_actor_id,
    product, quantity, unit, total_amount, currency, transaction_date, status,
    linked_transaction_group_id
  ) values (
    v_linked_group_id, NEW.supply_chain_id, 'Received', NEW.standard, NEW.owning_actor_id, NEW.actor_id,
    NEW.product, NEW.quantity, NEW.unit, NEW.total_amount, NEW.currency, NEW.transaction_date, 'Pending',
    NEW.transaction_group_id
  );

  insert into public.notifications (supply_chain_id, actor_id, type, title, message, link)
  values (
    NEW.supply_chain_id, NEW.actor_id, 'transaction_pending',
    'New stock received, awaiting your approval',
    NEW.quantity || ' ' || coalesce(NEW.unit, 'Kg') || ' of ' || NEW.product,
    '/transactions'
  );

  return NEW;
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
    '/transactions'
  );
end;
$function$;

-- Fix already-sent notifications too, not just future ones
UPDATE public.notifications
SET link = '/transactions'
WHERE link = '/transactions/received';
