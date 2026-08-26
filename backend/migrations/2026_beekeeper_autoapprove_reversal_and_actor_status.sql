-- Reversal, confirmed directly with Babs based on real user-testing
-- feedback: beekeeper-sourced Receive Stock transactions should go back
-- to auto-approving immediately. Earlier this session this was
-- deliberately changed to require review (matching every other
-- transaction), but real testing surfaced the correct reasoning: unlike
-- an actor-to-actor Send/Receive (a real second party who should
-- independently confirm), a beekeeper delivery is self-reported by the
-- same company's own Field Officer -- there is no independent second
-- party to review it, so requiring approval just added friction with no
-- real additional control.
create or replace function public.transactions_before_write()
returns trigger
language plpgsql
as $function$
declare
  v_code text;
begin
  if NEW.transaction_code is null or btrim(NEW.transaction_code) = '' then
    select transaction_code into v_code
    from public.transactions
    where transaction_group_id = NEW.transaction_group_id and transaction_code is not null
    limit 1;
    NEW.transaction_code := coalesce(v_code, public.random_transaction_code());
  end if;

  if NEW.direction = 'Received' and NEW.beekeeper_id is not null and NEW.status = 'Pending' then
    NEW.status := 'Approved';
  end if;

  return NEW;
end;
$function$;

-- Real gap found live: actors.status defaulted to 'Inactive' with zero
-- UI anywhere to change it after creation -- the only toggle that
-- exists on the actor detail page controls a completely different
-- field (the connection's own status), not this one. A newly created
-- actor was genuinely stuck, permanently, with no way to activate it.
-- Confirmed with Babs: new actors should default to Active, matching
-- the same reasoning as the earlier auto-connect fix -- the whole
-- point of creating one is to actively work with them.
alter table public.actors alter column status set default 'Active';
