-- Fixes: Receive Stock accepted negative quantities all the way through
-- to submission with no validation anywhere in the flow (Critical, live
-- UI/UX audit 2026-09-22).
--
-- The frontend fix (ReceiveStockForm.jsx) closes the actual reported
-- path, but a frontend-only check is never the real boundary in this
-- app -- it's a UI convenience, same principle this project already
-- applies to authorization (RLS is the real boundary, not role-based UI
-- hiding). Confirmed there was no database-level protection at all:
-- only transactions_processing_output_not_exceed_input existed, which
-- doesn't touch this. Any direct API call bypassing the frontend could
-- still insert a negative-quantity transaction. Zero existing rows
-- violate this (checked before adding), so no NOT VALID escape hatch
-- needed.

alter table transactions
  add constraint transactions_quantity_positive
  check (quantity > 0);
