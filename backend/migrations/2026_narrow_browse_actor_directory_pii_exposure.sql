-- Real, significant PII exposure found during an indirect-data-leakage
-- audit, confirmed live: browse_actor_directory() returned "SETOF
-- actors" (select * from actors, scoped only by supply_chain_id, no
-- role or connection check at all) -- meaning any authenticated user,
-- including a Field Officer with zero connections to anyone, could pull
-- every column for every actor in the tenant. Confirmed live: a real
-- Field Officer test account retrieved real contact_email and
-- contact_phone values for 5 completely unconnected actors.
--
-- Checked every real caller of this RPC (ConnectionFormDialog.jsx,
-- ContractWizard.jsx -- the only two that actually use it; ActorsList
-- and SendStockForm only have leftover comments referencing an earlier
-- version) before narrowing: none of them use anything beyond id,
-- contact_name, traceability_code, actor_type, or standards (the
-- fields genuinely needed to let someone identify and pick an actor to
-- request a connection or contract with -- the RPC's real, intended
-- purpose, confirmed by the existing comment in useActors.js explaining
-- why this deliberately bypasses the normal connection-gated RLS).
-- Narrowed the return type to exactly those fields, dropping
-- contact_email, contact_phone, and every other sensitive column --
-- once a real connection exists, actors_select's normal RLS correctly
-- grants full profile access to that specific, connected actor.
DROP FUNCTION public.browse_actor_directory();

CREATE FUNCTION public.browse_actor_directory()
 RETURNS TABLE(id uuid, contact_name text, actor_type text, traceability_code text, standards text[], country text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select id, contact_name, actor_type, traceability_code, standards, country
  from public.actors
  where supply_chain_id = auth_supply_chain_id();
$function$;
