-- Gap 12 follow-up: the claims/verification workflow (verify_claim /
-- reject_claim) was built as the only supposed path to change an entity's
-- standards, but the pre-existing direct edit forms (beekeeper header
-- edit, company profile edit) still write straight to
-- beekeepers.standards / actors.standards via a normal UPDATE. RLS allows
-- any Admin/Member to do this today -- no evidence note, no review, no
-- audit trail, and it completely bypasses claims. This made the whole
-- verification workflow decorative: a parallel unlocked door next to the
-- one that was actually built.
--
-- Fix: block any UPDATE that changes .standards unless a session-local
-- flag is set. verify_claim() is the only function that sets it, right
-- before it makes that exact change, in the same transaction. A normal
-- client-issued UPDATE (from useUpdateBeekeeper / useUpdateActor) never
-- sets this flag, so it's rejected with a clear error instead of silently
-- succeeding.
--
-- Deliberately UPDATE-only, not INSERT: onboarding (AddBeekeeperDialog,
-- ActorFormDialog) still sets an initial standards array directly on
-- creation, by explicit decision -- that's a separate, larger product
-- question about whether onboarding-time claims should also require
-- review, left open for now.

create or replace function public.guard_standards_update()
returns trigger
language plpgsql
as $function$
begin
  if NEW.standards is distinct from OLD.standards then
    if coalesce(current_setting('app.allow_standards_update', true), 'false') <> 'true' then
      raise exception 'Standards can only be changed through the claims verification workflow';
    end if;
  end if;
  return NEW;
end;
$function$;

drop trigger if exists trg_guard_beekeeper_standards on public.beekeepers;
create trigger trg_guard_beekeeper_standards
  before update on public.beekeepers
  for each row execute function public.guard_standards_update();

drop trigger if exists trg_guard_actor_standards on public.actors;
create trigger trg_guard_actor_standards
  before update on public.actors
  for each row execute function public.guard_standards_update();

-- verify_claim() must set the flag, local to its own transaction only
-- (the `true` third argument to set_config), right before making the
-- exact change the guard is checking for.
create or replace function public.verify_claim(p_claim_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_claim record;
  v_caller_role text;
  v_caller_supply_chain_id uuid;
begin
  select role, supply_chain_id into v_caller_role, v_caller_supply_chain_id
  from public.user_accounts where id = auth.uid();

  select * into v_claim from public.claims where id = p_claim_id;
  if v_claim is null then
    raise exception 'Claim not found';
  end if;
  if v_claim.supply_chain_id <> v_caller_supply_chain_id then
    raise exception 'Not authorized to verify this claim';
  end if;
  if v_caller_role not in ('Admin', 'Member') then
    raise exception 'Not authorized to verify this claim';
  end if;
  if v_claim.status <> 'Pending' then
    raise exception 'Only pending claims can be verified';
  end if;
  if v_claim.submitted_by = auth.uid() then
    raise exception 'You cannot verify a claim you submitted yourself';
  end if;

  update public.claims
  set status = 'Verified', verified_by = auth.uid(), verified_at = now()
  where id = p_claim_id;

  perform set_config('app.allow_standards_update', 'true', true);

  if v_claim.entity_type = 'beekeeper' then
    update public.beekeepers
    set standards = array_append(coalesce(standards, '{}'), v_claim.standard)
    where id = v_claim.entity_id and not (v_claim.standard = any(coalesce(standards, '{}')));
  else
    update public.actors
    set standards = array_append(coalesce(standards, '{}'), v_claim.standard)
    where id = v_claim.entity_id and not (v_claim.standard = any(coalesce(standards, '{}')));
  end if;
end;
$function$;
