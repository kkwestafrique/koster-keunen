-- Closes a real gap found reviewing reject_transaction_with_reversal():
-- it already creates a `notifications` row on reject, but nothing ever
-- emailed the supplying actor -- they'd only find out from the in-app bell.
--
-- This migration wires an AFTER INSERT trigger on `notifications`, scoped
-- to type = 'transaction_rejected', that calls the new
-- send-transaction-rejection-email Edge Function via pg_net. The database
-- write (notification, stock reversal, everything reject_transaction_with_
-- reversal already does) is unaffected either way -- this trigger fires
-- after that row exists, and a missing secret or failed HTTP call here
-- never rolls back or blocks the notification insert (net.http_post is
-- async / fire-and-forget by design; see the `perform`, no result checked).
--
-- Auth: a shared secret in Supabase Vault, generated here, known only to
-- this trigger and the Edge Function (via its own env var, set separately
-- in the dashboard -- never written to this repo). This is the same
-- reasoning as invite-team-member's JWT check, adapted for a caller with no
-- user session to present: a Postgres trigger has no browser tab, no JWT,
-- nothing to verify_jwt against, so the Edge Function is deployed with
-- verify_jwt disabled and checks this secret itself instead.

create extension if not exists pg_net;

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'transaction_email_trigger_secret') then
    perform vault.create_secret(
      gen_random_uuid()::text,
      'transaction_email_trigger_secret',
      'Shared secret so notifications-insert trigger can call send-transaction-rejection-email; must match TRANSACTION_EMAIL_TRIGGER_SECRET set on the Edge Function.'
    );
  end if;
end $$;

create or replace function public.trigger_transaction_rejection_email()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_secret text;
  v_function_url text := 'https://kxlejuifwhzqniohckbt.supabase.co/functions/v1/send-transaction-rejection-email';
begin
  if NEW.type <> 'transaction_rejected' then
    return NEW;
  end if;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets
  where name = 'transaction_email_trigger_secret'
  limit 1;

  -- Fail safe: if the secret isn't retrievable for any reason, skip the
  -- HTTP call rather than raise -- this must never block the notification
  -- insert (or, transitively, the reject/reversal it's part of).
  if v_secret is null then
    return NEW;
  end if;

  perform net.http_post(
    url := v_function_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
    body := jsonb_build_object('notification_id', NEW.id)
  );

  return NEW;
exception when others then
  -- Never let an email-trigger problem take down the notification write.
  return NEW;
end;
$function$;

drop trigger if exists trg_notifications_transaction_rejected_email on public.notifications;
create trigger trg_notifications_transaction_rejected_email
  after insert on public.notifications
  for each row execute function public.trigger_transaction_rejection_email();
