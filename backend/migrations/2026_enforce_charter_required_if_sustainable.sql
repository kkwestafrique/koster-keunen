-- Real gap found via bug-prevention audit: the "Charter required if
-- Sustainable" rule existed only in JavaScript, in two separate places
-- (AddBeekeeperDialog.jsx and useBulkUpload.js's validateRows) -- with
-- no matching database constraint. A direct insert, or any future
-- third code path, could bypass both checks entirely. This pushes the
-- same invariant down to the strongest layer, so it holds regardless
-- of which code path creates or edits a beekeeper row, now or later.
--
-- Confirmed zero existing rows would violate this before adding it, so
-- this is a real, fully-validated constraint, not a NOT VALID one that
-- only protects future rows while leaving existing violations
-- undetected.
--
-- Verified live with all 3 real cases: Sustainable + charter=false is
-- genuinely rejected; Sustainable + charter=true succeeds; no
-- Sustainable + charter=false succeeds (the constraint correctly only
-- fires when Sustainable is actually present).
alter table public.beekeepers
  add constraint beekeepers_charter_required_if_sustainable
  check (
    not ('Sustainable' = any(standards))
    or charter_signed = true
  );
