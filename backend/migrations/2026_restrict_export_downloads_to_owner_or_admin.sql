-- Real privacy gap found via security audit (Section 17: files).
-- private-media's storage policies scoped access by tenant only
-- (supply_chain_id), same as every other folder in this bucket. That's
-- correct for transaction/contract attachments -- those are meant to
-- be visible to anyone who can see the parent record, not just the
-- uploader. But it was also applying to exports/, where it's a real
-- problem: a report export can contain tenant-wide data an Admin
-- generated, while Member and Field Officer are both scoped to their
-- own actor everywhere else in this app. Either of those roles could
-- download someone else's full export and see data they'd never
-- normally reach through the UI -- a real bypass of the app's own
-- actor-level data isolation, just by going through the Downloads
-- panel instead.
--
-- Confirmed live before fixing: a real Field Officer could see all 3
-- real export files in storage.objects, none of which they generated.
--
-- Fixed by giving exports/ files a real, checkable owner: the upload
-- path now includes the uploader's own user id as a path segment
-- (frontend change, uploadMediaFile in src/lib/supabaseClient.js), and
-- these policies branch on it specifically for that one folder --
-- Admin can still reach every export in the tenant (matching their
-- existing, broader access everywhere else), but Member/Field Officer
-- can only reach the ones they generated themselves. Every other
-- folder (transactions, contracts) is completely untouched -- still
-- tenant-wide, exactly as before (the "folder <> 'exports' OR ..."
-- clause reduces to the original, unchanged tenant check for anything
-- that isn't exports).
--
-- Verified live after the fix: the same real Field Officer now sees 0
-- of the 3 export files (down from all 3 before); a real Admin still
-- sees all 3.
drop policy if exists private_media_select_authenticated on storage.objects;
create policy private_media_select_authenticated on storage.objects
for select to authenticated
using (
  bucket_id = 'private-media'
  and (storage.foldername(name))[2] = (auth_supply_chain_id())::text
  and (
    (storage.foldername(name))[1] <> 'exports'
    or auth_role() = 'Admin'
    or (storage.foldername(name))[3] = auth.uid()::text
  )
);

drop policy if exists private_media_delete_authenticated on storage.objects;
create policy private_media_delete_authenticated on storage.objects
for delete to authenticated
using (
  bucket_id = 'private-media'
  and (storage.foldername(name))[2] = (auth_supply_chain_id())::text
  and (
    (storage.foldername(name))[1] <> 'exports'
    or auth_role() = 'Admin'
    or (storage.foldername(name))[3] = auth.uid()::text
  )
);
