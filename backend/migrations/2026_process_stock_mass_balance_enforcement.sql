-- CRITICAL fix, from the independent BeezTrace QA audit (BUG-01,
-- the single most severe finding in the whole report): "Processing
-- invents inventory." The form correctly warned about real available
-- stock, but nothing actually BLOCKED submitting a mismatched amount --
-- the audit demonstrated entering 999kg source (5kg really available)
-- and getting 900kg of real, sellable output created, some of which
-- was then genuinely sent to another real actor. The audit also found
-- this exact pattern already existing in real production data.
--
-- Root cause, confirmed by reading the actual trigger code: output
-- stock creation (sync_transaction_to_stock) fires the moment a
-- transaction row is inserted and blindly creates NEW.quantity worth
-- of stock -- with zero reference to what was actually consumed via
-- consume_stock_batch(), which happens in separate, later calls from
-- the browser. By the time output stock gets created, there was no
-- way to check it against real consumption, because the consumption
-- hadn't happened yet in the sequence.
--
-- Confirmed with Babs: go straight for the complete structural fix,
-- not just a form-level patch. This new function performs consumption,
-- verification, and transaction-row creation all inside one atomic,
-- all-or-nothing operation -- there is no window where they can
-- disagree, and source_quantity/quantity_lost are computed from what
-- was actually consumed and produced, never accepted as trusted input.
-- If consumption would produce more output than was actually consumed
-- (quantity_lost would be negative), the entire operation is rejected
-- and nothing is created or deducted -- this is the exact invariant
-- that prevents inventing inventory from nothing.
--
-- Verified with real, live data: reproduced the exact audit scenario
-- (4 Kg real stock, attempted 900 Kg output) -- rejected with a clear
-- error, confirmed atomically (stock untouched at 4 Kg, zero stray
-- transactions or batch selections). Then verified the legitimate
-- success case (4 Kg consumed, 3.5 Kg produced) -- correctly created
-- with source_quantity=4 (the real consumed total, not a typed value),
-- quantity_lost=0.5 (correctly derived), source stock deducted to 0,
-- output stock created at exactly 3.5 Kg. All test data cleaned up
-- afterward.
create or replace function public.process_stock(
  p_source_product text,
  p_standard text,
  p_source_batches jsonb,
  p_destinations jsonb,
  p_transaction_type text,
  p_transaction_date date,
  p_currency text default null
)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_caller_role text;
  v_caller_supply_chain_id uuid;
  v_caller_actor_id uuid;
  v_batch record;
  v_available numeric;
  v_total_consumed numeric := 0;
  v_total_destination numeric := 0;
  v_quantity_lost numeric;
  v_dest record;
  v_group_id uuid := gen_random_uuid();
  v_code text := public.random_transaction_code();
  v_acting_disabled boolean;
begin
  select role, supply_chain_id into v_caller_role, v_caller_supply_chain_id
  from public.user_accounts where id = auth.uid();
  v_caller_actor_id := public.auth_current_actor_id();
  v_acting_disabled := public.auth_acting_actor_disabled();

  if v_acting_disabled then
    raise exception 'Not authorized: acting actor is disabled';
  end if;
  if v_caller_supply_chain_id is null then
    raise exception 'Not authorized';
  end if;

  for v_batch in select * from jsonb_to_recordset(p_source_batches) as x(stock_id uuid, quantity numeric)
  loop
    select quantity_available into v_available
    from public.stocks where id = v_batch.stock_id for update;

    if v_available is null then
      raise exception 'Batch not found: %', v_batch.stock_id;
    end if;
    if v_available < v_batch.quantity then
      raise exception 'Insufficient quantity available in selected batch (available: %, requested: %)', v_available, v_batch.quantity;
    end if;

    update public.stocks set quantity_available = quantity_available - v_batch.quantity where id = v_batch.stock_id;

    insert into public.transaction_batch_selections (transaction_group_id, stock_id, quantity_selected, supply_chain_id)
    values (v_group_id, v_batch.stock_id, v_batch.quantity, v_caller_supply_chain_id);

    v_total_consumed := v_total_consumed + v_batch.quantity;
  end loop;

  if v_total_consumed <= 0 then
    raise exception 'At least one real batch must be selected';
  end if;

  for v_dest in select * from jsonb_to_recordset(p_destinations) as x(product text, quantity numeric, unit text)
  loop
    v_total_destination := v_total_destination + v_dest.quantity;
  end loop;

  v_quantity_lost := v_total_consumed - v_total_destination;
  if v_quantity_lost < 0 then
    raise exception 'Cannot process: output quantity (%) exceeds what was actually consumed (%). This would create stock from nothing.',
      v_total_destination, v_total_consumed;
  end if;

  for v_dest in select * from jsonb_to_recordset(p_destinations) as x(product text, quantity numeric, unit text)
  loop
    insert into public.transactions (
      transaction_group_id, transaction_code, supply_chain_id, direction, transaction_type,
      standard, owning_actor_id, product, quantity, unit,
      source_product, source_quantity, quantity_lost, currency, transaction_date, status
    ) values (
      v_group_id, v_code, v_caller_supply_chain_id, 'Processing', p_transaction_type,
      p_standard, v_caller_actor_id, v_dest.product, v_dest.quantity, coalesce(v_dest.unit, 'Kg'),
      p_source_product, v_total_consumed, v_quantity_lost, p_currency, p_transaction_date, 'Approved'
    );
  end loop;

  return v_group_id;
end;
$function$;
