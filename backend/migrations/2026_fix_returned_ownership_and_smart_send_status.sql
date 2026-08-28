-- Real bug found and confirmed via a real, live rejection: the
-- "Returned" stock row created when a Received transaction is rejected
-- never had owning_actor_id set, so it existed in the database but was
-- invisible to the sender's own Stocks view (which filters by
-- owning_actor_id = current actor) -- effectively orphaned inventory,
-- confirmed directly: a real 20 Kg Beeswax-Yellow batch existed with
-- owning_actor_id = null. Same root mistake on the "Returned"
-- transaction record itself: actor_id was never set, showing as "-" in
-- the transaction list's Actor column instead of who it was returned
-- from.
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

-- Repair the real, live data from this exact incident -- the orphaned
-- stock and transaction rows created before this fix existed.
update public.stocks
set owning_actor_id = '33333333-3333-3333-3333-333333333333'
where id = '0c176211-c428-43cd-88e6-552542e892b4' and owning_actor_id is null;

update public.transactions
set actor_id = '33333333-3333-3333-3333-333333333331'
where transaction_group_id = '51980312-d429-49f1-9153-2ad2432353b3' and actor_id is null;

-- Smarter Send status label: found while investigating real feedback
-- that a bare "Approved" on a Send transaction's own detail page read
-- as "fully done and settled" even when the receiver hadn't confirmed
-- yet, or had since rejected it. Needed a way for the sender to check
-- the real, current status of the linked Received transaction on the
-- receiving actor's own side -- but RLS correctly blocked this by
-- default, confirmed directly (querying a real linked transaction as
-- the sender returned nothing, since it's owned by a different actor).
--
-- Extended narrowly, same pattern as the Contracts counterparty-
-- visibility fix earlier today: a transaction is also visible if it's
-- specifically linked to something the caller already owns. First
-- attempt caused a real, confirmed infinite-recursion error (the
-- subquery re-evaluated this same policy on itself) -- fixed with a
-- small SECURITY DEFINER helper, matching the existing
-- auth_current_actor_id()-style pattern already used throughout this
-- schema, avoiding the self-reference entirely.
create or replace function public.auth_owns_linked_transaction(p_linked_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $function$
  select exists(
    select 1 from public.transactions
    where transaction_group_id = p_linked_group_id
      and owning_actor_id = auth_current_actor_id()
  );
$function$;

drop policy if exists transactions_select on public.transactions;
create policy transactions_select on public.transactions
  for select
  using (
    (
      supply_chain_id = public.auth_supply_chain_id()
      and (
        owning_actor_id = public.auth_current_actor_id()
        or (owning_actor_id is null and public.auth_role() = 'Admin')
        or public.auth_owns_linked_transaction(linked_transaction_group_id)
      )
    )
    or public.has_permission(supply_chain_id, 'transactions', 'View')
  );
