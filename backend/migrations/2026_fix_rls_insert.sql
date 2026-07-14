-- Fix: actors/beekeepers inserts fail because their BEFORE INSERT triggers call
-- next_traceability_code(), which writes to traceability_sequences — a table with
-- RLS enabled but zero policies, and the function runs with the caller's (invoker)
-- privileges, so the write is blocked. Making the function SECURITY DEFINER lets it
-- bypass RLS for this internal bookkeeping table only, while RLS stays fully enabled
-- and locked down (no policies) on traceability_sequences itself for direct access.
alter function public.next_traceability_code(text)
  security definer
  set search_path = public;

-- Fix: user_accounts has SELECT/UPDATE "own row" policies but no INSERT policy, so a
-- newly authenticated user can never create their own profile row. Add an insert
-- policy scoped strictly to auth.uid() so users can only ever insert their own record.
create policy user_accounts_self_insert
  on public.user_accounts
  for insert
  with check (id = auth.uid());
