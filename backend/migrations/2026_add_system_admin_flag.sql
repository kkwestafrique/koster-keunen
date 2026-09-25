-- New genuine permission level, not reusing the existing per-actor Admin
-- role: this system has no prior concept of "KKWA staff" distinct from
-- any actor's own Admin. Without this, an /admin panel gated on the
-- existing Admin role would let any Local Partner's Admin see every
-- other actor's data -- a real violation of the actor-isolation model
-- this whole project has been built around.
--
-- Granted manually here to the one account that's clearly been acting
-- as KKWA's own operator throughout this project (kkwestafrique@gmail.com).
-- No UI to grant this to anyone else yet -- deliberately: this is a
-- narrow, manually-controlled permission, not a self-service one.

alter table public.user_accounts add column if not exists is_system_admin boolean not null default false;

update public.user_accounts
set is_system_admin = true
where id = 'cc209bae-9fb9-48a1-bd47-943040db12e9';
