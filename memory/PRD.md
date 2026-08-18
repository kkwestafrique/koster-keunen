# PRD — BeezTrace: Beeswax & Honey Supply Chain Traceability MIS

## Original Problem Statement
Verbatim rebuild of an existing live supply chain traceability MIS for a beeswax/honey
operation. Stack: React frontend + Supabase (Postgres/Auth/Storage) backend, no custom
API server. Deployment target: Vercel. Sentry + PostHog wired with placeholder
keys. TanStack Query for all data fetching (staleTime 30s on lists). Vercel Edge
Middleware for rate limiting (100 req/min/IP on /api/*). Roboto font (fallback Lato).
Exact design system (colors, badges, tables, buttons, login layout) specified by user —
see /app/frontend/tailwind.config.js `brand`/`badge` color tokens for the source of truth.

Screens (Run 1): Login, Actors (Potential/Actual lists + Detail), Beekeepers
(List/Potential/Actual lists + Detail), Villages list, Connections list, Sidebar nav with
My Actor switcher.

DB schema: actors, beekeepers, villages, connections, supply_chains, user_accounts,
constants — all in Supabase Postgres, RLS enabled, scoped by supply_chain_id.

## Architecture
- Frontend: React (CRA + craco), React Router v6, TanStack Query v5, shadcn/ui components,
  Tailwind (custom `brand`/`badge` tokens matching spec exactly).
- Backend: Supabase only — no FastAPI/MongoDB used. All data access via `@supabase/supabase-js`
  directly from the frontend (see /app/frontend/src/lib/supabaseClient.js).
- Auth: Supabase Auth email/password (see AuthContext.jsx), session in `user_accounts` table
  (username, role, current_actor_id, supply_chain_id, language_preference).
- Storage: Supabase Storage bucket `media` (public read, authenticated write) for actor logos.
- RLS: helper fn `auth_supply_chain_id()` looks up caller's `user_accounts.supply_chain_id`;
  every table policy filters `supply_chain_id = auth_supply_chain_id()`.
- Deployment target: Vercel — `vercel.json` (SPA rewrites) + `middleware.js` (Edge rate limiter,
  best-effort in-memory, matches /api/:path* for future serverless functions).
- PWA: manifest.json + service-worker.js (basic cache-first shell) + serviceWorkerRegistration.js,
  generated icon-192.png/icon-512.png/favicon.png.

## What's Been Implemented (2026-02, Run 1)
- Supabase project schema created & seeded via one-off script (tables, indexes, RLS policies,
  storage bucket, constants, demo data: 3 villages / 5 actors / 5 beekeepers / 3 connections).
- Admin user created (kkwestafrique@gmail.com) via Supabase Admin API, pre-confirmed, linked
  to `user_accounts` row (role Admin, supply_chain_id, current_actor_id).
- Login screen (split panel, brand colors).
- Sidebar (Dashboard, Actors > Potential/Actual, Beekeepers > List/Potential/Actual, Villages,
  Connections) + My Actor switcher (dropdown to switch current_actor_id).
- Dashboard with summary stat cards.
- Actors Potential/Actual list (search + type + country filters, zebra table, pagination 25/pg,
  Add Actor dialog with logo upload to Supabase Storage) + Actor Detail (tabs, progress bar,
  inline edit).
- Beekeepers List/Potential/Actual (search + gender + village + standard filters, Add Beekeeper
  dialog) + Beekeeper Detail.
- Villages list (search, beekeeper count column, Add Village dialog).
- Connections list (search + status + year filters, Add Connection dialog, Active/Revoked badge).
- Sentry/PostHog wired with placeholder keys (`/app/frontend/src/lib/sentry.js`, `posthog.js`).
- TanStack Query staleTime 30s on all list hooks (`src/hooks/use*.js`).

## Known Schema Gaps (per literal spec vs. given DB schema)
- Beekeepers list "standard" filter is rendered per spec, but `beekeepers` table has no
  `standard` column in the given schema — filter is UI-only (non-functional) until a column/
  relation is added.
- Actor "Potential" vs "Actual" screens are mapped to `status = Inactive` (Potential) and
  `status = Active` (Actual) since the actors table only has Active/Inactive (no separate
  Potential/Actual enum like beekeepers).

## Design System Update (2026-02, Run 2 — visual-only)
- Extracted real design tokens from user's Figma file via Figma REST API (file key
  YxVU02wklaCZ8MF19ESpzQ) — confirmed core palette (#0f48aa, #032b71, #ebf6ff, #f9fafc,
  #7089b4, #cfd8e6, #219653) already matched exactly; applied the concrete deltas found:
  - Font: Lato is primary (was Roboto-primary), Roboto kept as fallback.
  - Table headers: muted `#7089b4` bold (was navy `#032b71` medium).
  - Status/Standard badges: plain bold colored text, no pill background (was tinted-bg chip).
  - Buttons/Inputs/Select/Textarea: border-radius 4px (was 6px `rounded-md`).
  - Pagination active page: 3px radius.
  - TopBar: subtle drop shadow `0 4px 5px rgba(207,216,230,0.3)`.
- No functionality/routing/data/logic changed — testing agent confirmed 100% regression pass.

## Figma Verbatim Rebuild — AppLayout + Dashboard (2026-02, Run 3)
- Extracted precise layout specs from Figma file (node 11776:238, "KKWA dashboard" frame
  4533:19193) via Figma REST API (node tree + rendered PNG exports for visual verification),
  using user-provided personal access token.
- Sidebar rebuilt to 210px width, nav items with 40px icon badge (blue bg + white icon when
  active, transparent + blue icon when inactive), Lato 13px labels. My Actor switcher still
  pinned at bottom (unchanged).
- TopBar rebuilt: left shows CURRENT ACTOR name (bold blue) instead of generic page title
  (matches Figma's org-context topbar pattern); right shows notification bell (decorative) +
  account dropdown (avatar/username/role, Logout moved inside dropdown).
- Dashboard fully rebuilt: header + 5 real-data stat cards (Total actors, Local partners,
  Aggregators, Producer organisations, Beekeepers via new `useActorTypeCounts`/
  `useBeekeeperAggregates` hooks), 2 tabs (Supply chain overview real / Transaction overview
  placeholder — no transactions module exists), filter bar (Country/Level 1 actors — informational
  only, not yet wired), 3 recharts donut charts (Actor type distribution, Total hives installed,
  Beekeepers Male:Female) using real Supabase data.
- Other list pages (Actors/Beekeepers/Villages/Connections) unchanged functionally; their page
  title now renders as an in-content heading (AppLayout `title` prop) instead of inside TopBar,
  since TopBar is now global/actor-context-only. Not yet rebuilt to full Figma spec (deferred).
- Deliberate scope limits vs Figma (documented, not fabricated): dropped wax-quantity/kg charts,
  top-5-suppliers ranking, country-wise transaction %, crop-type hive distribution — none of
  this data exists in the current schema; only chart widgets backed by real data were built.

## Part 1 Verification + Critical Bug Fixes (2026-08, Run N)
Full click-through verification of Actors/Beekeepers/Contracts/Transactions/Sharing against
the live app, across 8 testing_agent passes (iteration_1 → iteration_8). All confirmed fixed:
- Sidebar `my-actor-switcher` now fully hidden (static label instead) for single-actor
  Member/Field Officer users; only renders as a real dropdown for multi-actor Admins.
- Disabled-actor lockout enforced at the UI level everywhere (new `useActingActor()` hook in
  `useActors.js`): Add/Edit/Delete buttons disabled across Beekeepers/Actors/Contracts/
  Transactions/Team-members/Company-profile, plus full-page read-only blocks on direct URL
  access to Send/Receive/Process/ContractWizard forms.
- ContractWizard Supplier dropdown now disabled + empty until a Standard is selected.
- Orphan beekeepers (`actor_id IS NULL`) no longer leak into every actor's Beekeepers list
  (`.not('actor_id','is',null)` filter in `useBeekeepers.js`).
- **DB fix** (`backend/migrations/2026_fix_contracts_member_read.sql`, applied by user via
  Supabase SQL Editor): Member/Field Officer roles could not read `contracts`/`contract_groups`
  at all — added a permissive `contracts_select_same_supply_chain` RLS policy matching the
  same supply-chain-wide scope every other entity table already has.
- **Critical root-cause fix**: `contracts`, `transactions` both have TWO foreign keys to
  `actors` (the counterparty `actor_id` + an `owning_actor_id`). Every raw-table query using
  an unqualified `actors(...)` PostgREST embed (ContractDetail, TransactionDetail, Report page
  aggregates, plus a `beekeepers`→`actors` embed with the same shape found later by a testing
  agent) threw "more than one relationship was found" / HTTP 300, silently breaking those
  pages for 2+ testing passes before being root-caused. Fixed everywhere via explicit
  `actors!actor_id(...)` / `actors!beekeepers_actor_id_fkey(...)` embed hints.
- **DB fix** (`backend/migrations/2026_fix_received_transaction_status.sql`, applied by user):
  the `transactions_before_write` trigger unconditionally forced `status := 'Approved'` on
  every Received-from-beekeeper transaction, making the entire Approve/Reject workflow
  unreachable. Removed that block — Received transactions now correctly insert as `Pending`,
  and the raw-material stock batch is only created by `sync_transaction_to_stock` once
  Approved (Reject leaves no stock behind, restores via `reject_transaction_with_reversal`).
- Bulk-upload of a non-`.xlsx` file no longer crashes the page (React error overlay) — now
  shows a clean inline error (`useBulkUpload.js` `loadFile()` catches + surfaces `parseError`).
- Minor: missing `beekeepersList.totalHives`/`activeYears` i18n keys added (en+fr); `/send/new`
  now redirects to the canonical `/transactions/send/new` instead of bouncing to the dashboard.
- Sharing & Permissions round-trip (share → recipient sees it → revoke) verified working —
  an earlier "silent failure" report did not reproduce on retest (network-level confirmed
  create_grant returns 200 and persists across a hard reload).

## Stock Lifecycle Check (2026-08, verification-only pass)
Full Receive → Approve → Processing → Merging → Loss walkthrough verified 100% against the
live app (iteration_9.json): Raw Material batch quantity decrements exactly on Processing
consumption, Final Product batch created at destination quantity, Loss row records
quantity_lost = source − destination, Merging locks destination=source and yields 0 loss, all
stock-list filters work. Two trivial fixes applied: Approve/Reject mutations were invalidating
the transaction detail query by the wrong cache key (group id vs the transaction_code it's
actually keyed by) — status badge could lag after clicking Approve/Reject; and a missing
data-testid on the Processing-mode destination-product selector. Open design question (not
fixed, needs your call): Loss list has no select/select-all checkboxes while Final Product
does — Loss list is a separate simpler component that never had that pattern ported over.

## Bulk Import Tool (2026-08, feature build)
Built the "This is historical data" toggle on the Transactions bulk-upload (Received > Multiple
mode) plus a new Contracts bulk-import dialog, per user's explicit scope choices (Transactions +
Contracts, reuse existing Transactions template columns, historical Received rows land Approved
immediately). New backend: `bulk_import_transaction(...)` RPC (applied by user) wraps
`app.bulk_import_mode` + the pre-existing `auto_consume_stock_for_bulk_import()` in one
transaction — also fixed a latent bug in that pre-existing function (missing `SECURITY DEFINER`
meant its stock UPDATE silently no-op'd under RLS; added via `ALTER FUNCTION`). Historical
Processing rows are rejected client-side (template has no source/destination product columns).
Contracts bulk-import reuses the plain insert path (no special RPC needed — contracts have no
bulk_import_mode-gated trigger). Note: Contracts imports don't appear on the Bulk Uploads history
page — user explicitly declined widening the `bulk_uploads.upload_type` CHECK constraint for it.
Verified end-to-end via testing_agent (iteration_10 → 11): Received/Send historical rows persist
Approved with correct currency, stock auto-consumes FIFO across batches correctly for Send.

## Actors/Beekeepers Member-Scoped Visibility Audit (2026-08, Run N+1)
Found and fixed a real gap: `actors` table had NO RLS restriction at all (any authenticated
user in the supply chain could SELECT every actor company-wide), unlike `beekeepers`
(already correctly scoped to `actor_id = auth_current_actor_id()`). Applied directly to
the live Supabase DB (verified via simulated `SET LOCAL ROLE authenticated` sessions, not
assumed) via `backend/migrations/2026_actors_connection_scoped_rls.sql`:
- New `actors_select` RLS: Admin sees every actor (unchanged); Member/Field Officer only see
  their own current actor + actors they have a real ACTIVE connection with (either direction
  via `connections`); cross-company `has_permission` sharing grants unaffected.
- New SECURITY DEFINER RPC `browse_actor_directory()` — the one shared "browse everyone"
  escape hatch for the 3 flows that must legitimately discover NOT-yet-connected actors:
  Add Connection dialog (both pickers), Contract wizard's supplier picker, Send's destination
  picker. Wired via new `useActorDirectory()` hook in `useActors.js`.
- `ActorsList.jsx`'s "Show connected only" checkbox is now Admin-only (hidden for Member/
  Field Officer, since RLS already fully governs their view — no longer a togglable no-op
  that briefly re-added self when unchecked).
- Also fixed: Send transaction detail page was missing a standalone "Currency" field (was
  appended inline to Total Amount instead, unlike the Received section) — now matches;
  plus an unrelated pre-existing bug found during this pass where Send's "Actor type" field
  displayed `tx.actors?.country` instead of `tx.actors?.actor_type`.
- Verified via testing_agent (iteration_12): Admin/Member/Field Officer visibility counts
  correct by name (not just count), full-directory pickers unaffected, currency fix confirmed.
- Known minor side-effect (not fixed, out of current scope): `connections_select` RLS is
  still supply-chain-wide (unchanged) — a Member viewing the Connections list can see a
  connection row between two OTHER actors they have no relationship with; the embedded
  actor name for the "unrelated" side now renders as "—" since that actor is correctly
  hidden by the new `actors` RLS. Flag for a future Connections-module-specific decision.

## Prioritized Backlog
- P0: None blocking.
- P1 (Part 2, from original handoff, not yet started): Email notification on transaction
  reject — user chose **Supabase's built-in email** (dev-only/limited) over Resend/SendGrid;
  Historical data migration script using `app.bulk_import_mode` + `auto_consume_stock_for_bulk_import()`.
- P2: Full Stocks section review (Loss list already spot-checked OK); Bulk Uploads history
  page audit; Loss list select/select-all checkboxes to match Final Product; Connections list
  cross-actor visibility decision (see note above); real Sentry DSN / PostHog key once provided.

## Next Action Items
- Build Task 2 (Part 2A): transaction-reject email notification via Supabase's built-in email.
- Build Task 3 (Part 2B): historical data migration script/tooling.
- Remaining audits: Task 5 (Stocks lifecycle full review), Task 6 (Bulk Uploads history),
  Loss list checkboxes.
- When ready to deploy to Vercel: connect the repo, set REACT_APP_SUPABASE_URL /
  REACT_APP_SUPABASE_ANON_KEY as Vercel env vars.
