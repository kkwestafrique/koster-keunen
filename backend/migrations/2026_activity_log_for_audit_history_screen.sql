-- Gap 8 (Medium, Phase 1): no dedicated audit-history screen existed.
-- The who/when data already exists scattered across individual records
-- (created_by/created_at/updated_by/updated_at on actors, beekeepers,
-- contracts, stocks, transactions; submitted_by/submitted_at,
-- verified_by/verified_at on claims) -- this view gathers it into one
-- place, one row per record, so the app can show a real activity feed.
--
-- Deliberately shows the CURRENT state of each record (who created it,
-- who last touched it) rather than a full event-by-event log -- that
-- full history (what a field used to say before an edit) is Gap 9,
-- scoped separately as its own larger piece of work with its own
-- access-control decision (Admin only, confirmed with Babs).
--
-- security_invoker = true is essential here: without it, a view is
-- evaluated with the view owner's permissions (effectively bypassing
-- RLS), not the querying user's. With it, the view respects exactly the
-- same supply_chain_id-scoped RLS policies each underlying table already
-- enforces -- confirmed this matters by testing as a real non-Admin
-- session, not just trusting the flag exists (a real Admin session saw
-- fewer rows than the unrestricted total, proving the per-actor scoping
-- flows through correctly).
--
-- contract_delivery_notifications and team_members are deliberately left
-- OUT of this view for now: neither has real, reliable creator/updater
-- data yet (contract_delivery_notifications has no creation path in the
-- app at all yet; team_members are inserted via the Invite Edge Function
-- using the service-role key, so auth.uid() at insert time would be
-- null, not the inviting Admin) -- showing them here would mean
-- inventing "who" data that isn't actually known, which is worse than
-- leaving them out.
create or replace view public.activity_log
with (security_invoker = true) as
  select
    'Actor'::text as entity_type,
    id as entity_id,
    contact_name as entity_label,
    created_by,
    created_at,
    updated_by,
    updated_at,
    supply_chain_id
  from public.actors
  union all
  select
    'Beekeeper',
    id,
    full_name,
    created_by,
    created_at,
    updated_by,
    updated_at,
    supply_chain_id
  from public.beekeepers
  union all
  select
    'Contract',
    id,
    contract_code,
    created_by,
    created_at,
    updated_by,
    updated_at,
    supply_chain_id
  from public.contracts
  union all
  select
    'Stock',
    id,
    product || coalesce(' — ' || batch_reference, ''),
    created_by,
    created_at,
    updated_by,
    updated_at,
    supply_chain_id
  from public.stocks
  union all
  select
    'Transaction',
    id,
    transaction_code,
    logged_by,
    created_at,
    updated_by,
    updated_at,
    supply_chain_id
  from public.transactions
  union all
  select
    'Claim',
    id,
    standard || ' (' || entity_type || ')',
    submitted_by,
    submitted_at,
    verified_by,
    coalesce(verified_at, submitted_at),
    supply_chain_id
  from public.claims;

grant select on public.activity_log to authenticated;

-- Gap 8 follow-up: user_accounts RLS only allows a user to see their own
-- row (id = auth.uid()) -- correct and deliberate elsewhere in this app,
-- but it means the activity_log view above can't resolve teammates'
-- usernames for the created_by/updated_by columns without either (a)
-- loosening user_accounts' RLS broadly, which is out of scope and
-- riskier than this feature needs, or (b) reimplementing every table's
-- existing per-actor RLS scoping logic inside a privileged function,
-- which risks getting that scoping subtly wrong.
--
-- Instead: one small, narrowly-scoped SECURITY DEFINER function, same
-- pattern as get_user_id_by_email already used by the invite Edge
-- Function. It returns id + username for every user in the CALLER'S OWN
-- supply chain only -- nothing more sensitive than that, and no other
-- tenant's data. The caller's own supply_chain_id is looked up via their
-- own user_accounts row, which they're already allowed to read.
create or replace function public.get_supply_chain_usernames()
returns table (id uuid, username text)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_caller_id uuid := auth.uid();
  v_caller_supply_chain_id uuid;
begin
  select ua.supply_chain_id into v_caller_supply_chain_id
  from public.user_accounts ua where ua.id = v_caller_id;

  if v_caller_supply_chain_id is null then
    raise exception 'Not authorized';
  end if;

  return query
    select ua.id, ua.username
    from public.user_accounts ua
    where ua.supply_chain_id = v_caller_supply_chain_id;
end;
$function$;

revoke all on function public.get_supply_chain_usernames() from public;
grant execute on function public.get_supply_chain_usernames() to authenticated;
