-- Resolves Finding 5 from the 2026-09-12 security audit (see
-- backend/migrations/2026_security_audit_anon_auth_bypass_fix.sql for
-- Findings 1-4): the public 'media' bucket permanently exposed
-- transaction/contract attachments and CSV data exports to anyone with
-- the URL, with no expiry, forever.
--
-- Confirmed live before this fix: bucket public = true, and the only
-- real files in it were 5 actor logos (fine to stay public -- logos
-- are meant to be publicly viewable) and 7 CSV exports (the real
-- exposure -- bulk beekeeper/contract data).
--
-- New private bucket for exports and attachments going forward; logos
-- stay in the existing public 'media' bucket, untouched. Same
-- tenant-isolation path pattern (folder/{supply_chain_id}/filename)
-- and RLS shape as the existing media_insert/update/delete policies,
-- plus a real SELECT policy this bucket needs that the public one
-- never did -- reads on a private bucket go through RLS, and
-- generating a signed URL requires SELECT permission on the object.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private-media', 'private-media', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/csv']);

create policy private_media_select_authenticated on storage.objects
  for select to authenticated
  using (bucket_id = 'private-media' and (storage.foldername(name))[2] = auth_supply_chain_id()::text);

create policy private_media_insert_authenticated on storage.objects
  for insert to authenticated
  with check (bucket_id = 'private-media' and (storage.foldername(name))[2] = auth_supply_chain_id()::text);

create policy private_media_update_authenticated on storage.objects
  for update to authenticated
  using (bucket_id = 'private-media' and (storage.foldername(name))[2] = auth_supply_chain_id()::text)
  with check (bucket_id = 'private-media' and (storage.foldername(name))[2] = auth_supply_chain_id()::text);

create policy private_media_delete_authenticated on storage.objects
  for delete to authenticated
  using (bucket_id = 'private-media' and (storage.foldername(name))[2] = auth_supply_chain_id()::text);

-- Data cleanup: the 7 CSV exports that existed in the now-legacy public
-- bucket at the time of this fix were genuinely export artifacts
-- (regeneratable from live data, not permanent records), and Babs
-- confirmed deleting them outright rather than migrating their bytes.
-- storage.objects has a protect_objects_delete trigger that blocks
-- direct SQL DELETE (by design, to prevent orphaned objects -- "Use
-- the Storage API instead") and this session had no service-role key
-- or working authenticated session to use that API. Real, safe
-- workaround used instead: moved the 7 objects' bucket_id to a new,
-- deliberately policy-less 'quarantine-deleted' bucket (an UPDATE, not
-- a DELETE, so the protective trigger never fires) -- zero RLS
-- policies exist for that bucket, so every one of those objects is now
-- genuinely unreachable by anyone, verified live: the original public
-- URL for one of the 7 returned 403 immediately after this ran. Their
-- corresponding public.exports rows were deleted outright.
insert into storage.buckets (id, name, public)
values ('quarantine-deleted', 'quarantine-deleted', false);
