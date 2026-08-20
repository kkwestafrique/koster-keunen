-- Gap 10 (Medium, Phase 4): stocks.owning_actor_id is the exact column
-- added for the stock-isolation security fix, and every stock query now
-- filters by it -- but it was never indexed. Not a problem at today's
-- small data volume; will become one as real data grows.
create index if not exists idx_stocks_owning_actor_id
  on public.stocks (owning_actor_id);

-- Gap 11 (Medium, Phase 9): every other core table (actors, beekeepers,
-- contracts) records updated_at via a BEFORE INSERT OR UPDATE trigger.
-- stocks and transactions only ever recorded updated_by, never
-- updated_at -- confirmed both columns were entirely absent.
alter table public.stocks
  add column if not exists updated_at timestamptz not null default now();

alter table public.transactions
  add column if not exists updated_at timestamptz not null default now();

-- A small, single-purpose trigger function, matching this project's
-- existing convention of separate single-purpose triggers per table
-- rather than folding this into an unrelated existing function
-- (set_audit_user_fields, transactions_before_write, etc).
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $function$
begin
  NEW.updated_at := now();
  return NEW;
end;
$function$;

drop trigger if exists trg_stocks_set_updated_at on public.stocks;
create trigger trg_stocks_set_updated_at
  before insert or update on public.stocks
  for each row execute function public.set_updated_at();

-- transactions already has strict immutability guardrails (RLS locked
-- down with USING(false) on UPDATE, only the approve_transaction /
-- attach_transaction_file SECURITY DEFINER RPCs can touch a row after
-- insert) -- this trigger still fires on those RPC-driven updates, since
-- triggers run regardless of RLS, so updated_at stays accurate through
-- the legitimate update paths without needing any change to those RPCs.
drop trigger if exists trg_transactions_set_updated_at on public.transactions;
create trigger trg_transactions_set_updated_at
  before insert or update on public.transactions
  for each row execute function public.set_updated_at();
