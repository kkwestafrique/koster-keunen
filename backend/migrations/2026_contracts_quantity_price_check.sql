-- Real bug found via independent audit (BUG-15): negative quantities
-- passed client-side validation end to end and reached a real created
-- contract (reproduced the audit's exact example: -50 Kg, producing a
-- nonsense negative total and a silently-zeroed advance percent).
-- Fixed the client-side form validation, but matching the same
-- discipline applied to the BUG-01 mass-balance fix, the database
-- itself is the real boundary -- a raw API call could otherwise still
-- bypass the form entirely. Price stays nullable (an intentional
-- "TBD" value used elsewhere in this flow), but if set, can't be
-- negative either.
--
-- Verified directly: a real insert with expected_quantity=-50 is
-- correctly rejected by contracts_expected_quantity_positive; a real
-- insert with price=-500 is correctly rejected by
-- contracts_price_non_negative; a real insert with valid positive
-- values succeeds normally.
alter table public.contracts
  add constraint contracts_expected_quantity_positive check (expected_quantity > 0),
  add constraint contracts_price_non_negative check (price is null or price >= 0);
