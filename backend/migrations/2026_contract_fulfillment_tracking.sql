-- Contract fulfillment tracking, built per Babs's request after
-- reviewing the Contracts section. No existing link between a real
-- Transaction and a Contract existed anywhere -- confirmed directly,
-- no dormant column to switch on this time, unlike several other
-- findings this session.
--
-- Links to the SPECIFIC contract row (contracts.id), not just
-- contract_group_id, since a contract can cover multiple products and
-- each row is one product line with its own committed quantity --
-- linking to the specific line is what makes honest per-product
-- fulfillment tracking possible (confirmed with Babs: per-product-line
-- progress, not one blended total across a multi-product contract,
-- since blending can hide an entire untouched product line behind a
-- deceptively reasonable-looking overall percentage).
--
-- Nullable and entirely optional -- most transactions won't have a
-- contract behind them at all. Only ever set at transaction creation
-- time; there's no update path for it, consistent with transactions
-- being immutable once approved (the very first Critical fix this
-- session).
alter table public.transactions
  add column if not exists contract_id uuid references public.contracts(id);

create index if not exists transactions_contract_id_idx
  on public.transactions (contract_id) where contract_id is not null;
