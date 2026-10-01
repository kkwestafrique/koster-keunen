-- Real, pre-existing bug found during live review (unrelated to any code
-- change today -- confirmed via a clean diff against main before touching
-- anything): lib/supabaseClient.js's MEDIA_ALLOWED_MIME_TYPES and its own
-- comment both document that xlsx support was added when reports switched
-- from .csv to .xlsx ("without this... the storage upload... would
-- silently fail every single time"). That documented intent was never
-- actually applied to the real storage buckets -- both 'media' and
-- 'private-media' were still missing the xlsx MIME type, so any xlsx
-- upload (a report being saved for the Downloads panel, or an xlsx
-- attached to a transaction/contract) was rejected by Supabase Storage
-- itself with "mime type ... is not supported", regardless of what the
-- client-side allowlist said.

update storage.buckets
set allowed_mime_types = array_append(allowed_mime_types, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
where id in ('media', 'private-media')
  and not ('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' = any(allowed_mime_types));
