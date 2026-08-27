-- Real design flaw found via actual user testing, reported directly:
-- "When I send wax to you, why should I be the one to approve it?
-- It's supposed to be you the receiver to approve it." Earlier work
-- this session built Send to require the SENDER'S OWN team to approve
-- their own outgoing shipment before anything happened -- backwards
-- from how shipping actually works, and confusing in practice.
-- Confirmed: remove the sender-side self-approval entirely. Admin-only
-- creation stays (that's still a real, meaningful control -- not just
-- anyone can trigger a shipment). The moment an Admin creates a Send,
-- it's final immediately: sender's stock deducts right away, and the
-- receiver gets their own Pending item to review -- exactly how Receive
-- already worked before any of this Send work started. The receiver
-- approving what arrived IS the real review step, not a redundant
-- second gate on the sender's own side.

-- 1. Recreate the linked-Received cascade as an AFTER INSERT trigger,
-- firing immediately when a Send is created (reversing the earlier move
-- of this same logic into approve_transaction(), which is no longer
-- correct now that Send skips Pending/approval entirely).
create or replace function public.create_linked_received_for_send()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
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
    '/transactions/received'
  );

  return NEW;
end;
$function$;

drop trigger if exists trg_create_linked_received_for_send on public.transactions;
create trigger trg_create_linked_received_for_send
  after insert on public.transactions
  for each row execute function public.create_linked_received_for_send();

-- 2. Strip the Send-specific stock-deduction and cascade logic back out
-- of approve_transaction() -- Send no longer goes through this function
-- at all, since it's never Pending. Reverts to a plain, direction-
-- agnostic status flip (which in practice now only ever matters for
-- Received transactions).
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
begin
  select role, supply_chain_id into v_caller_role, v_caller_supply_chain_id
  from public.user_accounts where id = auth.uid();

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

-- 3. reject_transaction_with_reversal(): revert to Received-only,
-- matching its original pre-Send-workflow behavior -- there's nothing
-- for a sender to reject on their own Send anymore, since it's never
-- Pending on their side.
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
begin
  select role, supply_chain_id into v_caller_role, v_caller_supply_chain_id
  from public.user_accounts where id = auth.uid();

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

  insert into public.stocks (supply_chain_id, stock_type, product, standard, batch_reference, quantity_available, unit)
  values (
    v_send.supply_chain_id, 'Final Product', v_send.product, v_send.standard,
    'Returned -- rejected by receiving actor',
    v_total_quantity, coalesce(v_send.unit, 'Kg')
  )
  returning id into v_returned_stock_id;

  v_returned_group_id := gen_random_uuid();

  insert into public.transactions (
    transaction_group_id, supply_chain_id, direction, standard, owning_actor_id,
    product, quantity, unit, total_amount, currency, transaction_date, status,
    linked_transaction_group_id, destination_stock_id
  ) values (
    v_returned_group_id, v_send.supply_chain_id, 'Received', v_send.standard, v_send.owning_actor_id,
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

-- 4. Real bug found via actual user testing: "when you receive 4
-- products from a beekeeper only one shows". Confirmed directly against
-- a real 4-product delivery -- all 4 rows existed correctly in the
-- database, and Transaction Detail correctly showed all 4 (it queries
-- the raw table directly), but this list-summary view's product column
-- used min(product), which silently picks whichever product name sorts
-- alphabetically first and discards the rest.
--
-- A genuinely serious, separate finding made while fixing this: the
-- view had no security_invoker setting, meaning it ran with its owner's
-- (postgres, which has BYPASSRLS) privileges rather than the querying
-- user's -- any authenticated user querying this view directly (not
-- through the app's own client-side supply_chain_id filter, which is
-- trivially bypassable) could have seen every company's transactions
-- across the whole database. Verified directly: unrestricted total was
-- 38 transaction groups; a real RLS-scoped session correctly saw only
-- 8 after this fix. Added security_invoker = true, matching the same
-- safe pattern already used for activity_log.
create or replace view public.transaction_groups
with (security_invoker = true) as
  select
    transaction_group_id,
    supply_chain_id,
    direction,
    transaction_type,
    standard,
    actor_id,
    beekeeper_id,
    currency,
    invoice_number,
    bl_number,
    transaction_date,
    logged_by,
    min(source_product) as source_product,
    max(source_quantity) as source_quantity,
    case
      when count(distinct product) > 1
        then min(product) || ' (+' || (count(distinct product) - 1) || ' more)'
      else min(product)
    end as product,
    sum(quantity) as total_quantity,
    sum(total_amount) as total_amount,
    min(created_at) as created_at,
    max(quantity_lost) as quantity_lost,
    min(status) as status,
    min(transaction_code) as transaction_code
  from public.transactions
  group by transaction_group_id, supply_chain_id, direction, transaction_type, standard, actor_id, beekeeper_id, currency, invoice_number, bl_number, transaction_date, logged_by;
