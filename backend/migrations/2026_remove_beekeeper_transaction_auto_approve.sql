-- Real bug found and confirmed via direct testing (as Babs's own real
-- account): transactions_before_write() force-set status = 'Approved'
-- for any Received transaction sourced directly from a beekeeper,
-- completely overriding whatever status the frontend explicitly
-- requested. ReceiveStockForm.jsx explicitly sends status: 'Pending' --
-- its own code comment says this was a deliberate fix for a different,
-- earlier bug -- but this trigger silently discarded that and forced
-- 'Approved' anyway, for every single Receive Stock submission (since
-- beekeeper_id is always required on that form).
--
-- Confirmed directly with Babs: the correct behavior is that beekeeper
-- deliveries require review like every other transaction, the same as
-- this trigger's own comment originally intended before an earlier
-- session added this override. Removing the override entirely --
-- status now always follows the column default ('Pending') or whatever
-- the frontend explicitly sends, with no special-casing by source.
--
-- Confirmed safe: sync_transaction_to_stock() only credits stock for a
-- Received transaction when status = 'Approved', so a Pending beekeeper
-- delivery correctly waits for explicit approval before affecting
-- stock, exactly like every other Received transaction already does.
-- approve_transaction() has no special-casing for beekeeper-sourced
-- transactions either, so approving one works identically to any other.
--
-- Verified end to end with disposable test data, then rolled back:
-- inserted a real Received transaction sourced from a beekeeper,
-- confirmed it stayed Pending, confirmed no stock row existed yet,
-- called approve_transaction(), confirmed status flipped to Approved
-- and exactly one stock row was created only then.
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
