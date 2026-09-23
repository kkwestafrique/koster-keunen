-- Fixes: the Download button (top bar) throws a real error when
-- clicking to re-download an export, for two related reasons found by
-- investigation:
--
-- 1. private_media_select_authenticated (and the matching delete
--    policy) determine the creator of an export by parsing the THIRD
--    segment of its storage path (exports/<supply_chain_id>/<user_id>/
--    <file>) and requiring it to equal auth.uid(). Exports created
--    before that user-id folder segment existed in the path structure
--    (exports/<supply_chain_id>/<file> -- only two segments) have no
--    third segment at all, so this condition can never be true for
--    anyone non-Admin -- including the export's own original creator.
--    Confirmed live: every sampled pre-existing export row has this
--    shorter path shape.
--
-- 2. Independently, useRecentExports() (frontend) lists exports scoped
--    only by supply_chain_id -- tenant-wide, no per-creator filter --
--    while the storage policy only allows a non-Admin to actually open
--    their own. Confirmed live: the list query has no created_by
--    filter at all. A non-Admin sees every teammate's exports listed
--    and can click any of them, but only their own actually opens.
--
-- Root cause of both: authorization here was derived from the storage
-- PATH's structure, which is fragile and depends on every export
-- having been created after a specific point in time. exports.
-- created_by already exists, is populated on every row (verified:
-- zero nulls, old and new alike), and is the real, reliable source of
-- truth regardless of path shape. Switching the check to it fixes
-- old-format exports permanently and works identically for all future
-- ones, without depending on path structure at all.
--
-- (frontend fix for issue 2 -- scoping the list itself -- is a
-- separate, accompanying change to useExports.js, not this migration.)

DROP POLICY IF EXISTS private_media_select_authenticated ON storage.objects;
CREATE POLICY private_media_select_authenticated ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'private-media'
  AND (storage.foldername(name))[2] = (auth_supply_chain_id())::text
  AND (
    (storage.foldername(name))[1] <> 'exports'
    OR auth_role() = 'Admin'
    OR EXISTS (
      SELECT 1 FROM public.exports e
      WHERE e.file_url = name AND e.created_by = auth.uid()
    )
  )
);

DROP POLICY IF EXISTS private_media_delete_authenticated ON storage.objects;
CREATE POLICY private_media_delete_authenticated ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'private-media'
  AND (storage.foldername(name))[2] = (auth_supply_chain_id())::text
  AND (
    (storage.foldername(name))[1] <> 'exports'
    OR auth_role() = 'Admin'
    OR EXISTS (
      SELECT 1 FROM public.exports e
      WHERE e.file_url = name AND e.created_by = auth.uid()
    )
  )
);
