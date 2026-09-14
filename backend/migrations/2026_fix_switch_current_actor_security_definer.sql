-- Real regression found and confirmed live, reported directly by Babs:
-- "I'm trying to switch actors, I can't." Root cause: switch_current_actor()
-- was never SECURITY DEFINER, so its internal UPDATE on user_accounts ran
-- as the calling user, subject to that user's own RLS -- including the
-- user_accounts_self_update policy that Finding 3 of the 2026-09-12
-- security audit correctly tightened to pin current_actor_id to its
-- existing value (closing the real actor-impersonation bug where a user
-- could PATCH their own current_actor_id directly, bypassing this
-- function's own membership check entirely). That fix was correct and
-- necessary, but it had a real side effect on this function that wasn't
-- caught at the time: it also blocked this RPC's own, legitimate,
-- already-membership-verified update from ever succeeding for a genuine
-- actor switch. Confirmed live with Babs's own real account: switching to
-- an actor already assigned as current_actor_id succeeded (a no-op,
-- false-positive test), but switching to any genuinely different,
-- legitimately-available actor failed with a real RLS violation.
--
-- Fix: mark this function SECURITY DEFINER so its update runs with
-- elevated privileges, bypassing the caller's own RLS for this one,
-- specific write -- safe to do because the function already performs its
-- own real, correct authorization check (a live team_members row with
-- status = 'Active' for that specific actor) before ever reaching the
-- update, so nothing about who's allowed to switch to what actor changes.
-- Also adds SET search_path, matching the same hardening already applied
-- to every other SECURITY DEFINER function this session and the fix
-- pattern recommended in Finding 6 of the same audit.
CREATE OR REPLACE FUNCTION public.switch_current_actor(p_actor_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_allowed boolean;
begin
  select exists(
    select 1 from public.team_members
    where user_id = auth.uid() and actor_id = p_actor_id and status = 'Active'
  ) into v_allowed;

  if not v_allowed then
    raise exception 'You do not have approved access to that actor.';
  end if;

  update public.user_accounts set current_actor_id = p_actor_id where id = auth.uid();
end;
$function$;
