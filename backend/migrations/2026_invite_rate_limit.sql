-- Gap 3 (High): no custom rate limiting existed anywhere. The one real
-- server-controlled endpoint in the system, the Invite-a-team-member Edge
-- Function, uses the service-role key to send real emails and create real
-- auth accounts -- none of which goes through Supabase's normal public
-- signup rate limits, since it's called via the admin API rather than the
-- public auth flow. A compromised or malicious Admin account could
-- otherwise spam-invite (email flooding) or repeatedly call the
-- email-lookup RPC to enumerate which emails already have accounts.
--
-- This table is a plain attempt log the Edge Function checks before doing
-- any real work: count this caller's rows in the last rolling hour, and
-- reject with 429 if over the threshold (see
-- supabase/functions/invite-team-member/index.ts). Only the service role
-- ever touches this table (the Edge Function uses the service-role
-- client), so RLS denies everyone else by default -- no policies are
-- added on purpose.
create table if not exists public.invite_attempts (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists invite_attempts_caller_id_created_at_idx
  on public.invite_attempts (caller_id, created_at);

alter table public.invite_attempts enable row level security;
-- No policies added: default-deny for anon/authenticated. Only the
-- service-role key (used exclusively by the Edge Function) can read or
-- write this table, since service role bypasses RLS entirely.
