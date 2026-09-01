-- Real gap found via independent audit (BUG-32): "connections/
-- permission grants never recorded" in the change history / audit
-- trail. Confirmed directly: neither table had any logging trigger at
-- all, unlike contracts and transactions, which both correctly use the
-- existing log_field_change() function.
--
-- connections has a real supply_chain_id column, so the existing,
-- unmodified log_field_change() function attaches directly -- no
-- changes made to that function, avoiding any risk to the
-- already-working contracts/transactions logging.
create trigger trg_connections_log_change
  after insert or update or delete on public.connections
  for each row execute function public.log_field_change();

-- permission_grants uses grantor_supply_chain_id, not supply_chain_id
-- -- the shared function would error on this table directly. A small,
-- dedicated variant reusing the same core logic and writing to the
-- same field_change_log table, adapted for this table's real column.
create or replace function public.log_permission_grant_change()
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
begin
  if TG_OP = 'DELETE' then
    v_record_id := OLD.id;
    v_supply_chain_id := OLD.grantor_supply_chain_id;
    v_old := to_jsonb(OLD);
    v_new := null;
  elsif TG_OP = 'INSERT' then
    v_record_id := NEW.id;
    v_supply_chain_id := NEW.grantor_supply_chain_id;
    v_old := null;
    v_new := to_jsonb(NEW);
  else
    v_record_id := NEW.id;
    v_supply_chain_id := NEW.grantor_supply_chain_id;
    v_old := to_jsonb(OLD);
    v_new := to_jsonb(NEW);
    select array_agg(n.key) into v_changed_fields
    from jsonb_each(v_new) n
    join jsonb_each(v_old) o using (key)
    where n.value is distinct from o.value;
  end if;

  insert into public.field_change_log
    (table_name, record_id, action, changed_by, old_data, new_data, changed_fields, supply_chain_id, group_id)
  values
    (TG_TABLE_NAME, v_record_id, TG_OP, auth.uid(), v_old, v_new, v_changed_fields, v_supply_chain_id, null);

  return coalesce(NEW, OLD);
end;
$function$;

create trigger trg_permission_grants_log_change
  after insert or update or delete on public.permission_grants
  for each row execute function public.log_permission_grant_change();
