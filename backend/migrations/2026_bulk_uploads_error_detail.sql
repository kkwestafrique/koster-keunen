-- Real bug found via independent audit (BUG-21): "Connections uploads
-- failed, no error detail". Confirmed exactly: both bulk upload code
-- paths (the generic beekeeper/actor path and the transactions-specific
-- path) already collect real, specific per-row error messages into an
-- `errors` array as they process -- that array was just never actually
-- saved anywhere. The bulk_uploads table had no column to hold it at
-- all. Adding one so the diagnostic information already being
-- captured in memory can actually reach the person who needs it.
alter table public.bulk_uploads add column if not exists error_detail text;
