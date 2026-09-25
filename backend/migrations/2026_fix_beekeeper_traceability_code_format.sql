-- Fixes: beekeeper traceability codes didn't include the parent actor's
-- sequence number at all -- just a country-wide beekeeper counter
-- (KKWA-<country>-<6digit>). Spec requires
-- KKWA-<country>-<actor sequence>-<beekeeper sequence>.
--
-- Actor codes are unchanged (KKWA-<country>-<5digit>, already matches).
--
-- Design: reuse traceability_sequences' existing (country_code,
-- record_type) PK by passing the ACTOR's own traceability_code as the
-- scoping "country_code" specifically for beekeeper generation --
-- this scopes the beekeeper counter per-actor without any schema
-- migration, since the column is just a text key already.

CREATE OR REPLACE FUNCTION public.next_traceability_code(p_country text, p_record_type text DEFAULT 'actor'::text, p_actor_code text DEFAULT NULL::text)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
declare
  v_code text;
  v_seq integer;
  v_digits integer;
  v_actor_country text;
  v_actor_seq text;
begin
  if p_record_type = 'beekeeper' then
    if p_actor_code is null then
      raise exception 'next_traceability_code: beekeeper generation requires the parent actor''s traceability code';
    end if;
    -- Parse KKWA-<CC>-<5digit> back into its parts
    v_actor_country := split_part(p_actor_code, '-', 2);
    v_actor_seq := split_part(p_actor_code, '-', 3);

    insert into public.traceability_sequences (country_code, record_type, next_seq)
      values (p_actor_code, 'beekeeper', 2)
    on conflict (country_code, record_type) do update
      set next_seq = public.traceability_sequences.next_seq + 1
    returning next_seq - 1 into v_seq;

    return 'KKWA-' || v_actor_country || '-' || v_actor_seq || '-' || lpad(v_seq::text, 6, '0');
  end if;

  v_code := public.country_code(p_country);
  v_digits := 5;

  insert into public.traceability_sequences (country_code, record_type, next_seq)
    values (v_code, p_record_type, 2)
  on conflict (country_code, record_type) do update
    set next_seq = public.traceability_sequences.next_seq + 1
  returning next_seq - 1 into v_seq;

  return 'KKWA-' || v_code || '-' || lpad(v_seq::text, v_digits, '0');
end;
$function$;

CREATE OR REPLACE FUNCTION public.beekeepers_before_write()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
declare
  v_country text;
  v_effective_actor_id uuid;
  v_actor_code text;
begin
  if NEW.traceability_code is null or btrim(NEW.traceability_code) = '' then
    select country into v_country from public.villages where id = NEW.village_id;
    -- Real gap found fixing this: trg_beekeepers_before_write fires
    -- BEFORE trg_set_beekeeper_actor_id alphabetically (Postgres fires
    -- same-timing triggers in name order), so NEW.actor_id can still be
    -- null here on a normal interactive insert. Resolved locally the
    -- same way set_beekeeper_actor_id does, rather than depending on
    -- trigger firing order or touching that trigger's own logic.
    v_effective_actor_id := coalesce(NEW.actor_id, (select current_actor_id from public.user_accounts where id = auth.uid()));
    if v_effective_actor_id is not null then
      select traceability_code into v_actor_code from public.actors where id = v_effective_actor_id;
    end if;
    NEW.traceability_code := public.next_traceability_code(v_country, 'beekeeper', v_actor_code);
  end if;
  NEW.updated_at := now();
  return NEW;
end;
$function$;
