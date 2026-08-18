-- Actors table had NO real RLS restriction on SELECT (every authenticated
-- user in the supply chain could see every actor company-wide), unlike
-- beekeepers/contracts/transactions which are already actor-scoped.
-- Fix: Admin keeps full company visibility. Member/Field Officer only see
-- their own current actor plus actors they have a real ACTIVE connection
-- with (either direction). Cross-company sharing grants (has_permission)
-- still work exactly as before.
drop policy if exists actors_select on public.actors;

create policy actors_select on public.actors for select
  using (
    (
      supply_chain_id = auth_supply_chain_id()
      and (
        auth_role() = 'Admin'
        or id = auth_current_actor_id()
        or exists (
          select 1 from public.connections c
          where c.status = 'Active'
            and (
              (c.actor_from_id = auth_current_actor_id() and c.actor_to_id = actors.id)
              or (c.actor_to_id = auth_current_actor_id() and c.actor_from_id = actors.id)
            )
        )
      )
    )
    or has_permission(supply_chain_id, 'actors', 'View')
  );

-- One shared "full company directory" RPC for the 3 legitimate flows that
-- must browse EVERY actor regardless of connection status (you can't
-- create a connection with someone you're not yet connected to): the
-- Add Connection dialog (both actor pickers), the Contract wizard's
-- supplier picker, and Send's destination picker. SECURITY DEFINER runs
-- as the table owner, which bypasses the restrictive policy above by
-- design -- this is intentional, read-only directory browsing, not a
-- write path, and requires no extra role gate beyond being a real
-- authenticated member of the supply chain.
create or replace function public.browse_actor_directory()
returns setof public.actors
language sql
stable
security definer
set search_path = public
as $$
  select * from public.actors
  where supply_chain_id = auth_supply_chain_id();
$$;

grant execute on function public.browse_actor_directory() to authenticated;
