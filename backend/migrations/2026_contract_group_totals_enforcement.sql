-- Closes a real, confirmed-live bug found while closing out earlier design
-- decisions from this project's contract spec: total_amount was being
-- stored as the PER-LINE amount (this row's expected_quantity * price),
-- not the whole-contract total across every product line in the group, as
-- specified. advance_percent was stored as a flat 0 on every row -- the
-- auto-calculation (advance_amount_paid / total_amount * 100) was never
-- actually implemented anywhere. Confirmed live divergence before writing
-- this: 2 of 3 multi-product contract groups already had mismatched
-- total_amount between rows in the same group.
--
-- Fixed at the database level with a trigger that recomputes both values
-- from the group's real product lines on every insert/update, and writes
-- the same correct value to every row in the group. This makes the fix
-- unconditional -- correct regardless of what the frontend happens to
-- send, rather than requiring a matching frontend fix to stay correct.
--
-- pg_trigger_depth() = 1 guard: the trigger's own UPDATE of sibling rows
-- in the group would otherwise re-fire itself on each of those rows too.
-- Harmless (the second pass computes the same already-correct numbers),
-- but wasteful and worth avoiding cleanly rather than relying on
-- convergence.

create or replace function public.sync_contract_group_totals()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_group_id uuid := coalesce(NEW.contract_group_id, OLD.contract_group_id);
  v_total numeric;
  v_advance_paid numeric;
begin
  if pg_trigger_depth() > 1 then
    return NEW;
  end if;
  if v_group_id is null then
    return NEW;
  end if;

  select coalesce(sum(expected_quantity * price), 0)
  into v_total
  from public.contracts
  where contract_group_id = v_group_id;

  -- advance_amount_paid is already entered identically across every row
  -- in a group by the existing form (confirmed against live data before
  -- writing this) -- take whichever non-null value is present.
  select advance_amount_paid into v_advance_paid
  from public.contracts
  where contract_group_id = v_group_id and advance_amount_paid is not null
  limit 1;
  v_advance_paid := coalesce(v_advance_paid, 0);

  update public.contracts
  set
    total_amount = v_total,
    advance_percent = case when v_total > 0 then round((v_advance_paid / v_total) * 100, 2) else 0 end
  where contract_group_id = v_group_id
    and (total_amount is distinct from v_total
      or advance_percent is distinct from case when v_total > 0 then round((v_advance_paid / v_total) * 100, 2) else 0 end);

  return NEW;
end;
$function$;

drop trigger if exists trg_sync_contract_group_totals on public.contracts;
create trigger trg_sync_contract_group_totals
  after insert or update of expected_quantity, price, advance_amount_paid, contract_group_id
  on public.contracts
  for each row execute function public.sync_contract_group_totals();

-- One-time backfill for the contract groups already confirmed live-broken.
update public.contracts c
set
  total_amount = g.group_total,
  advance_percent = case when g.group_total > 0 then round((coalesce(c.advance_amount_paid, 0) / g.group_total) * 100, 2) else 0 end
from (
  select contract_group_id, sum(expected_quantity * price) as group_total
  from public.contracts
  group by contract_group_id
) g
where c.contract_group_id = g.contract_group_id;
