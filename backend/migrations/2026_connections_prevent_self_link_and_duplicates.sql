-- Real gaps found during a connection-lifecycle audit, confirmed live:
-- self-linking (actor_from_id = actor_to_id) and duplicate connections
-- between the same pair of actors were only prevented by the frontend's
-- dropdown filtering -- neither was independently enforced at the
-- database level, and both were confirmed exploitable via a direct
-- insert bypassing the UI entirely. Low security impact (neither grants
-- any access beyond what an actor already has), but real data-integrity
-- gaps worth closing at the real boundary, not just the UI.

-- Self-linking: a plain CHECK constraint, can't be bypassed by any
-- client.
alter table public.connections
  add constraint connections_no_self_link check (actor_from_id <> actor_to_id);

-- Duplicate connections: a connection between A and B is the same
-- relationship regardless of which side is actor_from_id vs
-- actor_to_id, so a naive unique constraint on (actor_from_id,
-- actor_to_id) alone would miss the reverse-direction case. A unique
-- index on the sorted pair (least/greatest) catches both directions.
-- Safe for genuine re-linking after a real unlink: the delete feature
-- removes the row entirely (confirmed live earlier in this same
-- audit), so there's no leftover row for a new request to collide
-- with once a connection has actually been removed.
create unique index connections_unique_actor_pair
  on public.connections (least(actor_from_id, actor_to_id), greatest(actor_from_id, actor_to_id));
