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

## Prioritized Backlog
- P0: None blocking — core CRUD + auth + RLS + storage verified working end-to-end.
- P1: Actor/Beekeeper Edit persistence for all fields (currently a subset of fields editable
  inline on Actor Detail); Village/Connection detail+edit views; role-based hiding of
  Add/Edit buttons for Viewer role.
- P2: Real Sentry DSN / PostHog key once provided; swap in-memory Edge Middleware rate limiter
  for Vercel KV/Upstash before production traffic; French language toggle
  (`language_preference` field exists but UI not localized yet).

## Next Action Items
- Provide real Sentry DSN / PostHog API key when ready to swap placeholders.
- Confirm if "standard" should be added as a real column/relation for beekeepers filtering.
- When ready to deploy to Vercel: connect the repo, set REACT_APP_SUPABASE_URL /
  REACT_APP_SUPABASE_ANON_KEY as Vercel env vars, and consider upgrading middleware.js to use
  Vercel KV for real distributed rate limiting.
