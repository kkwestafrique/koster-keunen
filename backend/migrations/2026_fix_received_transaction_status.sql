-- Fix: every new "Received from a beekeeper" transaction (beekeeper_id set,
-- actor_id null -- the normal/only shape a beekeeper-sourced Received
-- transaction ever has) was being silently force-approved on INSERT,
-- regardless of what status the client explicitly sent, skipping the
-- entire Approve/Reject workflow that TransactionDetail.jsx's UI (and the
-- reject_transaction_with_reversal RPC) exist specifically to drive.
--
-- Root cause, confirmed directly against the live project via
-- pg_get_functiondef(): the BEFORE INSERT trigger function
-- transactions_before_write() contained this unconditional block:
--   if NEW.direction = 'Received' and NEW.beekeeper_id is not null and NEW.actor_id is null then
--     NEW.status := 'Approved';
--   end if;
-- Since that condition matches EVERY normal beekeeper-sourced Received row
-- (there is no legitimate Received-from-beekeeper case where actor_id is
-- ever set), this made the Approve/Reject feature permanently unreachable
-- via the standard creation flow.
--
-- This fix only removes that block; the transaction_code generation logic
-- in the same function (unrelated) is preserved byte-for-byte, and the
-- separate create_linked_received_for_send trigger (which explicitly sets
-- 'Pending' on the linked Received row it creates for Send transactions,
-- and always has actor_id set on that row) is untouched and unaffected
-- either way.
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
  return NEW;
end;
$function$;
