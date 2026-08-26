-- Send Stock currently has zero review of any kind: any authenticated
-- user could create one, it was immediately Approved, and real stock was
-- deducted instantly at creation -- for what is likely the single most
-- financially consequential action in the app (a real shipment to a
-- real buyer at a real price). Confirmed with Babs directly: this
-- should change to (1) Admin-only creation, (2) require review before
-- final (matching Receive), (3) deferred stock deduction so a still-
-- Pending Send costs nothing to cancel.

-- 1. Restrict creation: only Admin may create a Send transaction.
-- Every other direction keeps its existing behavior unchanged.
drop policy if exists transactions_insert on public.transactions;
create policy transactions_insert on public.transactions
  for insert
  with check (
    (not public.auth_acting_actor_disabled())
    and (
      (
        direction = 'Send' and supply_chain_id = public.auth_supply_chain_id()
        and owning_actor_id = public.auth_current_actor_id()
        and public.auth_role() = 'Admin'
      )
      or (
        direction <> 'Send'
        and (
          (supply_chain_id = public.auth_supply_chain_id() and (owning_actor_id = public.auth_current_actor_id() or owning_actor_id is null))
          or public.has_permission(supply_chain_id, 'transactions', 'Edit')
        )
      )
    )
  );

-- 2. New function: record which batch a transaction intends to use,
-- WITHOUT touching real stock yet. Used by Send at creation time now,
-- instead of consume_stock_batch (which does both in one step -- still
-- used unchanged by Process, since Processing genuinely is immediate).
-- The availability check here is a courtesy for sane UX, not the real
-- guarantee -- the authoritative check happens at approval time, row-
-- locked, since stock could change between selection and approval.
create or replace function public.record_batch_selection(p_stock_id uuid, p_quantity numeric, p_transaction_group_id uuid)
returns void
language plpgsql
as $function$
declare
  v_available numeric;
  v_supply_chain_id uuid;
begin
  select quantity_available, supply_chain_id into v_available, v_supply_chain_id
  from public.stocks where id = p_stock_id;

  if v_available is null then
    raise exception 'Batch not found';
  end if;
  if v_available < p_quantity then
    raise exception 'Insufficient quantity available in selected batch (available: %, requested: %)', v_available, p_quantity;
  end if;

  insert into public.transaction_batch_selections (transaction_group_id, stock_id, quantity_selected, supply_chain_id)
  values (p_transaction_group_id, p_stock_id, p_quantity, v_supply_chain_id);
end;
$function$;

-- 3. Found while building this: an existing AFTER INSERT trigger
-- (create_linked_received_for_send) already auto-created a linked
-- Pending Received transaction for the destination actor the instant a
-- Send was inserted -- a real, working, two-sided mechanism that
-- predates this session's work and was incorrectly assumed dead (an
-- earlier grep only checked frontend code, not database triggers).
-- Firing this on raw INSERT is now inconsistent with Send's own new
-- Admin-approval step: the buyer would be notified, and could act on
-- a Pending item, before the sender's own team had approved anything.
-- If the sender later rejected their own Send, there was no way to
-- retract what the buyer had already seen. Confirmed with Babs: the
-- buyer should only be notified once the sender's own Admin approves.
-- Moved the entire cascade (linked Received creation + notification)
-- out of the trigger and into approve_transaction() itself, alongside
-- the sender's own stock deduction -- both now happen together, only
-- on approval.
drop trigger if exists trg_create_linked_received_for_send on public.transactions;

-- 4. approve_transaction: for Send specifically, this is now the moment
-- real stock actually gets deducted -- using the selections recorded at
-- creation, row-locked (FOR UPDATE) to protect against a concurrent
-- approval of a different Send that used the same batch in the
-- meantime. If stock has genuinely run out since selection, the
-- approval itself fails loudly rather than silently going negative.
-- Then, only once that succeeds, creates the linked Received + notifies
-- the destination actor (see point 3 above).
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
  v_selection record;
  v_available numeric;
  v_linked_group_id uuid;
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

  if v_tx.direction = 'Send' then
    for v_selection in
      select stock_id, quantity_selected from public.transaction_batch_selections
      where transaction_group_id = p_transaction_group_id
    loop
      select quantity_available into v_available
      from public.stocks where id = v_selection.stock_id for update;

      if v_available is null or v_available < v_selection.quantity_selected then
        raise exception 'Cannot approve: batch no longer has enough stock available (needed %, has %)',
          v_selection.quantity_selected, coalesce(v_available, 0);
      end if;

      update public.stocks set quantity_available = quantity_available - v_selection.quantity_selected
      where id = v_selection.stock_id;
    end loop;

    v_linked_group_id := gen_random_uuid();

    update public.transactions set linked_transaction_group_id = v_linked_group_id
    where transaction_group_id = p_transaction_group_id;

    insert into public.transactions (
      transaction_group_id, supply_chain_id, direction, standard, actor_id, owning_actor_id,
      product, quantity, unit, total_amount, currency, transaction_date, status,
      linked_transaction_group_id
    ) values (
      v_linked_group_id, v_tx.supply_chain_id, 'Received', v_tx.standard, v_tx.owning_actor_id, v_tx.actor_id,
      v_tx.product, v_tx.quantity, v_tx.unit, v_tx.total_amount, v_tx.currency, v_tx.transaction_date, 'Pending',
      v_tx.transaction_group_id
    );

    insert into public.notifications (supply_chain_id, actor_id, type, title, message, link)
    values (
      v_tx.supply_chain_id, v_tx.actor_id, 'transaction_pending',
      'New stock received, awaiting your approval',
      v_tx.quantity || ' ' || coalesce(v_tx.unit, 'Kg') || ' of ' || v_tx.product,
      '/transactions/received'
    );
  end if;
end;
$function$;

-- 5. reject_transaction_with_reversal: extend to handle Send. Nothing
-- was ever deducted for a still-Pending Send (deduction now only
-- happens inside approve_transaction above), so rejecting one needs no
-- reversal at all -- just the status flip with the reason/comment
-- captured, same as everything else already does. The existing
-- Received-specific reversal-and-notify logic is untouched.
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
  if v_tx.direction not in ('Received', 'Send') then
    raise exception 'Only Received or Send transactions can be rejected';
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

  if v_tx.direction = 'Send' then
    return;
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
    '/transactions/send'
  );
end;
$function$;
