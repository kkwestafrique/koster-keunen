-- Explicit request: remove the "Other" gender option entirely, not just
-- fix its broken display (the label was showing the raw, missing
-- translation key "common.other" instead of real text). Confirmed zero
-- existing beekeeper records use this value before removing it from the
-- database constraint too, so this is a clean removal, not a migration.
alter table public.beekeepers drop constraint beekeepers_gender_check;
alter table public.beekeepers add constraint beekeepers_gender_check
  check (gender = any (array['Male', 'Female']));
