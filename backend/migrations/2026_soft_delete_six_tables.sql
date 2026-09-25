-- Vibe-coding-checklist gap closed: "Nothing's ever really deleted."
-- Confirmed live before writing this: actors/beekeepers/contracts/
-- transactions correctly have no delete path at all (by earlier design
-- in this project -- disable-only for actors, immutable + reject/
-- reversal for transactions and contracts). But exchange_rates,
-- team_members, exports, connections, villages, and claims all had a
-- real, unrecoverable .delete() call in the frontend, with nothing
-- stopping a mistaken click from being permanent -- exactly what today's
-- own testing needed more than once (a hard DELETE on a test
-- transaction row, earlier in this session, was the only option
-- available for any of these tables' general pattern).
--
-- deleted_at/deleted_by added to all six. Existing UPDATE policies
-- already permit the same Admin/Member roles that could previously
-- delete, so soft-deleting is just an UPDATE under policies that
-- already exist -- no new UPDATE policy needed. DELETE policies
-- dropped entirely: hard delete is no longer possible for any of these
-- tables under a normal user's role, only via the service role, which
-- bypasses RLS by design and is outside any policy's reach anyway.
-- SELECT policies updated to exclude soft-deleted rows, so a deleted
-- row simply stops appearing anywhere in the app, exactly like a real
-- delete would look to a user, while the row itself is still there,
-- recoverable, stamped with who and when.

do $$
declare
  t text;
begin
  foreach t in array array['exchange_rates','team_members','exports','connections','villages','claims']
  loop
    execute format('alter table public.%I add column if not exists deleted_at timestamptz', t);
    execute format('alter table public.%I add column if not exists deleted_by uuid references auth.users(id)', t);
  end loop;
end $$;

drop policy if exists exchange_rates_delete on public.exchange_rates;
drop policy if exists team_members_delete on public.team_members;
drop policy if exists exports_delete on public.exports;
drop policy if exists connections_delete on public.connections;
drop policy if exists villages_delete on public.villages;
drop policy if exists claims_delete on public.claims;

drop policy if exists exchange_rates_select on public.exchange_rates;
create policy exchange_rates_select on public.exchange_rates for select
  using (supply_chain_id = auth_supply_chain_id() and deleted_at is null);

drop policy if exists exports_select on public.exports;
create policy exports_select on public.exports for select
  using (supply_chain_id = auth_supply_chain_id() and deleted_at is null);

drop policy if exists villages_select on public.villages;
create policy villages_select on public.villages for select
  using (supply_chain_id = auth_supply_chain_id() and deleted_at is null);

drop policy if exists connections_select on public.connections;
create policy connections_select on public.connections for select
  using (supply_chain_id = auth_supply_chain_id() and deleted_at is null);

drop policy if exists claims_select on public.claims;
create policy claims_select on public.claims for select
  using (supply_chain_id = auth_supply_chain_id() and deleted_at is null);

drop policy if exists team_members_select on public.team_members;
create policy team_members_select on public.team_members for select
  using (
    actor_id in (select actors.id from actors where actors.supply_chain_id = auth_supply_chain_id())
    and deleted_at is null
  );
