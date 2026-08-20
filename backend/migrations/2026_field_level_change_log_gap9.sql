-- Gap 9 (Medium, Phase 9): no field-level "what changed, from what to
-- what" tracking existed anywhere. The activity_log view (Gap 8) shows
-- who last touched a record and when, but never what it used to say
-- before the change. Scope agreed with Babs: Transactions, Contracts,
-- and Stocks only (not all 6 activity_log tables) -- Admin-only viewing.
--
-- field_change_log stores a full old/new row snapshot per change (not
-- just the diff) plus a computed changed_fields array for a quick
-- summary, since storing only the diff would make "what did the whole
-- record look like at that point" impossible to answer later.
create table if not exists public.field_change_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('INSERT','UPDATE','DELETE')),
  changed_by uuid,
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb,
  changed_fields text[],
  supply_chain_id uuid not null,
  -- Contracts and Transactions are GROUPED entities -- multiple product
  -- lines share one contract_group_id / transaction_group_id, each as
  -- its own row with its own id. Extracted here by the trigger so the
  -- frontend can query "all history for this contract" with a plain
  -- equality filter instead of a JSONB path filter (which has no
  -- precedent elsewhere in this codebase and couldn't be verified
  -- against the live REST API from this sandbox). Null for stocks,
  -- correctly, since those are single-row entities with nothing to
  -- group by.
  group_id uuid
);

create index if not exists field_change_log_record_idx
  on public.field_change_log (table_name, record_id, changed_at desc);
create index if not exists field_change_log_supply_chain_idx
  on public.field_change_log (supply_chain_id, changed_at desc);
create index if not exists field_change_log_group_id_idx
  on public.field_change_log (group_id, changed_at desc);

alter table public.field_change_log enable row level security;

-- Admin only, confirmed with Babs -- this table can carry beekeeper PII
-- and full historical snapshots, more raw detail than the normal UI
-- exposes anywhere else. Verified directly: a Field Officer session saw
-- 0 rows against real test data; an Admin session saw all of them.
create policy field_change_log_select on public.field_change_log
  for select
  using (
    supply_chain_id = public.auth_supply_chain_id()
    and public.auth_role() = 'Admin'
  );
-- No INSERT/UPDATE/DELETE policies for anyone -- only the SECURITY
-- DEFINER trigger function below can write here, same default-deny
-- pattern already used for invite_attempts earlier this session. This
-- matters specifically for an audit trail: an authenticated user must
-- never be able to write a fabricated log entry directly via the API,
-- only have their real changes captured by the trigger.

-- SECURITY DEFINER is required here, unlike this app's other triggers
-- (actors_before_write, set_updated_at, etc): those only touch NEW's own
-- fields on the SAME row/table the invoking user already has RLS
-- permission to write. This trigger writes to a DIFFERENT, more
-- restricted table that regular users have no INSERT policy on at all --
-- without SECURITY DEFINER, every write to transactions/contracts/stocks
-- would fail the moment this trigger tried to log it.
create or replace function public.log_field_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_record_id uuid;
  v_supply_chain_id uuid;
  v_old jsonb;
  v_new jsonb;
  v_changed_fields text[];
  v_group_id uuid;
begin
  if TG_OP = 'DELETE' then
    v_record_id := OLD.id;
    v_supply_chain_id := OLD.supply_chain_id;
    v_old := to_jsonb(OLD);
    v_new := null;
  elsif TG_OP = 'INSERT' then
    v_record_id := NEW.id;
    v_supply_chain_id := NEW.supply_chain_id;
    v_old := null;
    v_new := to_jsonb(NEW);
  else
    v_record_id := NEW.id;
    v_supply_chain_id := NEW.supply_chain_id;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    select array_agg(n.key) into v_changed_fields
    from jsonb_each(v_new) n
    join jsonb_each(v_old) o using (key)
    where n.value is distinct from o.value;
  end if;

  -- Only contracts and transactions have a grouping column; stocks has
  -- neither, so this stays null there, which is correct.
  v_group_id := coalesce(
    (coalesce(v_new, v_old)->>'contract_group_id')::uuid,
    (coalesce(v_new, v_old)->>'transaction_group_id')::uuid
  );

  insert into public.field_change_log
    (table_name, record_id, action, changed_by, old_data, new_data, changed_fields, supply_chain_id, group_id)
  values
    (TG_TABLE_NAME, v_record_id, TG_OP, auth.uid(), v_old, v_new, v_changed_fields, v_supply_chain_id, v_group_id);

  return coalesce(NEW, OLD);
end;
$function$;

drop trigger if exists trg_transactions_log_change on public.transactions;
create trigger trg_transactions_log_change
  after insert or update on public.transactions
  for each row execute function public.log_field_change();
-- transactions has no working DELETE path (transactions_delete policy is
-- USING(false)), so no DELETE trigger is needed here.

drop trigger if exists trg_contracts_log_change on public.contracts;
create trigger trg_contracts_log_change
  after insert or update or delete on public.contracts
  for each row execute function public.log_field_change();

drop trigger if exists trg_stocks_log_change on public.stocks;
create trigger trg_stocks_log_change
  after insert or update or delete on public.stocks
  for each row execute function public.log_field_change();
