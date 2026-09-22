-- Fixes: bulk_import_transaction() fails for any actor/beekeeper not
-- already flagged for the transaction's standard, with a confusing,
-- unrelated error: "Standards can only be changed through the claims
-- verification workflow".
--
-- Root cause: transactions_check_standard_flag() auto-appends a new
-- standard onto the referenced actor's/beekeeper's `standards` array
-- when app.bulk_import_mode is true, but that append is itself an
-- UPDATE, which is separately gated by guard_standards_update() --
-- requiring app.allow_standards_update = 'true' as well.
-- bulk_import_transaction() only ever set the first of the two.
-- Reproduced live against production (in a rolled-back transaction)
-- before this fix, and confirmed the fix works the same way, before
-- writing this migration.
--
-- This is the live app's own Historical Import feature -- any real
-- user importing a transaction for a supplier/beekeeper whose
-- standards don't already include that transaction's standard (the
-- normal case for a first-time historical import) hits this today.

CREATE OR REPLACE FUNCTION public.bulk_import_transaction(p_direction text, p_standard text, p_actor_id uuid, p_beekeeper_id uuid, p_product text, p_quantity numeric, p_unit text, p_price numeric, p_currency text, p_transaction_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
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
  perform set_config('app.allow_standards_update', 'true', true);

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
