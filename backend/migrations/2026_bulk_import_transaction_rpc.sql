-- New RPC backing the "This is historical data" toggle on the Transactions
-- bulk-upload flow (Received/Send only -- Processing needs a separate
-- source/destination product which the existing flat template has no
-- columns for, so it's rejected client-side before ever reaching here).
--
-- Historical rows are already-completed past records, so they always land
-- 'Approved' immediately (confirmed with the product owner) rather than
-- going through the normal Pending review step.
--
-- `app.bulk_import_mode` and auto_consume_stock_for_bulk_import() (both
-- already existing in this schema) only work correctly when set/called in
-- the SAME database transaction as the row insert -- not reachable from a
-- plain client-side `.insert()` via PostgREST, since there is no guarantee
-- consecutive REST calls share a session/transaction. Wrapping both steps
-- in one plpgsql function guarantees that: `set_config(..., true)` with
-- is_local=true scopes the setting to this function's own transaction,
-- and it's gone again the moment this call returns -- it can never leak
-- into a normal, interactive transaction creation.
create or replace function public.bulk_import_transaction(
  p_direction text,
  p_standard text,
  p_actor_id uuid,
  p_beekeeper_id uuid,
  p_product text,
  p_quantity numeric,
  p_unit text,
  p_price numeric,
  p_currency text,
  p_transaction_date date
)
returns jsonb
language plpgsql
as $function$
declare
  v_group_id uuid := gen_random_uuid();
  v_supply_chain_id uuid;
  v_shortfall numeric := 0;
begin
  if p_direction not in ('Received', 'Send') then
    raise exception 'bulk_import_transaction only supports Received and Send, got %', p_direction;
  end if;

  select supply_chain_id into v_supply_chain_id
  from public.user_accounts where id = auth.uid();

  if v_supply_chain_id is null then
    raise exception 'No supply_chain_id found for the current user';
  end if;

  perform set_config('app.bulk_import_mode', 'true', true);

  insert into public.transactions (
    transaction_group_id, supply_chain_id, direction, standard, actor_id, beekeeper_id,
    product, quantity, unit, price, total_amount, currency, transaction_date, status
  ) values (
    v_group_id, v_supply_chain_id, p_direction, p_standard, p_actor_id, p_beekeeper_id,
    p_product, p_quantity, coalesce(p_unit, 'Kg'), p_price,
    case when p_price is not null then p_quantity * p_price else null end,
    p_currency, p_transaction_date, 'Approved'
  );

  if p_direction = 'Send' then
    v_shortfall := public.auto_consume_stock_for_bulk_import(v_group_id);
  end if;

  return jsonb_build_object('transaction_group_id', v_group_id, 'stock_shortfall', v_shortfall);
end;
$function$;
