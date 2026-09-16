-- Critical, live-confirmed cross-tenant PII leak found via security
-- audit (Section 9: indirect leakage). This function had no
-- supply_chain_id scoping at all, and its only gate was "is logged in"
-- -- any authenticated user, from any tenant, could call it with any
-- actor's real connect_id and receive that actor's full contact_email,
-- contact_phone, and complete address (country/state/LGA/village),
-- with no connection or relationship to that actor required at all.
--
-- Confirmed live: a real, unconnected Field Officer from a completely
-- different actor successfully retrieved full PII for a real, unrelated
-- actor using nothing but its connect_id.
--
-- The real severity here isn't reduced by connect_id being high-entropy
-- (it is) -- a connect_id is *designed* to be shared (that's the entire
-- point: someone gives it out so others can find and connect with
-- them), so anyone who ever legitimately received one, from any tenant,
-- could pull full PII without ever actually connecting.
--
-- Checked the real, only frontend caller (ActorFormDialog.jsx) before
-- fixing this, rather than guess at the right shape: it only ever
-- reads found.id, found.contact_name, found.actor_type, and
-- found.country -- never email, phone, or address. Narrowed the
-- function to return exactly that, matching the same
-- minimal-until-connected principle already used by
-- browse_actor_directory(), and added the same supply_chain_id scoping
-- the rest of this connect flow already assumes (the existing
-- duplicate-connection check filters by supply_chain_id too, so
-- cross-tenant connect was never a real, intended use case).
--
-- Verified live after the fix: the same real, unconnected Field
-- Officer, same real connect_id -- now returns only id, contact_name,
-- actor_type, country. Email, phone, and address are gone.
drop function lookup_actor_by_connect_id(text);

create function public.lookup_actor_by_connect_id(p_connect_id text)
returns table(id uuid, contact_name text, actor_type text, country text)
language sql
security definer
set search_path to 'public'
as $function$
  select id, contact_name, actor_type, country
  from public.actors
  where connect_id = p_connect_id
    and auth.uid() is not null
    and supply_chain_id = auth_supply_chain_id()
  limit 1;
$function$;
