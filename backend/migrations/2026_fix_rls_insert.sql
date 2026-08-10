-- Two separate fixes proposed in the original version of this file.
-- Status of each, checked directly against the live database:

-- 1. next_traceability_code() SECURITY DEFINER -- NOT NEEDED, NOT APPLIED.
-- The original diagnosis (traceability_sequences has RLS enabled with
-- zero policies, blocking real users from creating actors/beekeepers) was
-- checked directly and found to be outdated: a policy already exists
-- (`traceability_sequences_authenticated`, requiring only
-- `auth.uid() is not null`), and a real simulated authenticated session
-- was verified able to insert an actor and receive a correctly-generated
-- traceability_code with no error. Left unapplied since it isn't fixing
-- an active problem.

-- 2. user_accounts self-insert policy -- CORRECT, ALREADY APPLIED LIVE.
-- This is genuinely needed and matches the "own row only" pattern used
-- everywhere else on this table (self-select, self-update). Already
-- applied to the live database exactly as below; this is safe to re-run
-- (drops first, matching the idempotent pattern used throughout this
-- project's own migrations -- Postgres has no CREATE POLICY IF NOT EXISTS).
drop policy if exists user_accounts_self_insert on public.user_accounts;
create policy user_accounts_self_insert
  on public.user_accounts
  for insert
  with check (id = auth.uid());
