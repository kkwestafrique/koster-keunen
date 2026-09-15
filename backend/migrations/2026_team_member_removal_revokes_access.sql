-- Real gap found via security audit (Section 21: account deactivation):
-- useRemoveTeamMember only ever deleted the team_members row. But every
-- authorization function in the app (auth_role, auth_current_actor_id,
-- auth_supply_chain_id) reads only from user_accounts, never
-- team_members -- confirmed directly from their definitions. So
-- "removing" someone from the team UI never actually revoked their
-- access: their session, role, and actor scope were completely
-- unaffected, since nothing that controls real access ever looked at
-- the row that got deleted.
--
-- Fixed as a trigger on team_members, not just a frontend change, so
-- this is enforced no matter what deletes the row -- not only the one
-- button in the UI.
--
-- An Admin can legitimately belong to more than one actor (the
-- invite-team-member function explicitly supports this), so this
-- can't just always lock the account on any single removal:
--   - If the removed user still has other team_members rows, and their
--     current_actor_id was the one just removed, switch them to one of
--     their remaining actors rather than breaking their still-valid
--     access to those.
--   - If this was their last team_members row, genuinely revoke access
--     by clearing supply_chain_id (and current_actor_id) to NULL.
--     Every existing RLS policy already requires
--     supply_chain_id = auth_supply_chain_id() as a real AND condition
--     -- including the Admin-role checks, which are nested inside that
--     same condition, not standalone -- so a NULL supply_chain_id on
--     the account genuinely locks out all tenant-scoped access,
--     Admin or not, without needing to touch any of those existing
--     policies.

create or replace function public.revoke_access_on_team_member_removal()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_remaining_actor_id uuid;
begin
  -- Only act if the removed row's user still exists as a user_account
  -- (it always should, but this keeps the trigger safe regardless).
  if not exists (select 1 from public.user_accounts where id = old.user_id) then
    return old;
  end if;

  select actor_id into v_remaining_actor_id
  from public.team_members
  where user_id = old.user_id
  order by created_at desc
  limit 1;

  if v_remaining_actor_id is not null then
    -- Still belongs to at least one other actor. Only touch
    -- current_actor_id if it was pointing at the actor just removed --
    -- if they were already scoped to a different, still-valid actor,
    -- leave that alone.
    update public.user_accounts
    set current_actor_id = v_remaining_actor_id
    where id = old.user_id
      and current_actor_id = old.actor_id;
  else
    -- This was their last team_members row -- genuinely revoke access.
    update public.user_accounts
    set current_actor_id = null,
        supply_chain_id = null
    where id = old.user_id;
  end if;

  return old;
end;
$$;

drop trigger if exists team_member_removal_revokes_access on public.team_members;
create trigger team_member_removal_revokes_access
  after delete on public.team_members
  for each row
  execute function public.revoke_access_on_team_member_removal();
