# Load testing plan

## Why this exists

A performance audit this session covered real, measurable things —
bundle size, database indexes, RLS query plans, over-fetching, the
Dashboard's request pattern. All of that was verified directly against
the live codebase and database. Load testing is different: it needs
real, sustained concurrent traffic, which can't be safely generated
against the live Supabase project from here without risking disruption
to a real, shared environment. This plan is what to actually run,
written so it can be picked up and executed directly rather than left
as a vague "do some load testing" line item.

## Tool: k6

Recommended over Artillery for this specific job: k6 scripts are
JavaScript, so the real flows below (sign in, hit a few endpoints) read
naturally; it reports p50/p95/p99 out of the box, which is exactly what
matters here (see "What to measure" below); and it runs as a single
binary with no project scaffolding needed.

```bash
# macOS
brew install k6
# Linux
sudo gpg -k && sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6
```

## Environment: a disposable Supabase branch, never the live project

Same pattern already used for this repo's smoke-test suite
(`scripts/smoke-test.js`) and the historical-import testing — a
disposable branch, not the project real users are on.

```bash
# From the Supabase CLI, authenticated against this project
supabase branches create load-test
```

This gives an isolated Postgres instance with the same schema, RLS
policies, and indexes as production, but zero real data and zero real
users affected by whatever happens during the run. Point the test
script's `SUPABASE_URL` / `SUPABASE_ANON_KEY` at this branch, never at
the real project's values.

Seed it with realistic volume before running anything — the whole
point is catching problems that only appear at scale, and an empty
branch behaves identically to production's current near-empty state.
A few thousand synthetic beekeepers and tens of thousands of
transactions is a reasonable starting point, since that's roughly
where this app's stated 10,000-user target would land it.

## What to measure

- **p50, p95, p99 latency** per flow below — not just the average. A
  p50 that looks fine can hide a p99 that's genuinely broken for a
  meaningful slice of real users; k6 reports all three by default.
- **Error rate** — any non-2xx response, any RLS rejection that
  shouldn't have happened.
- **Throughput** — requests/second the system sustains before latency
  degrades.

## Realistic scenarios

Each of these is a real, existing flow in the app, not a hypothetical
endpoint. Scripts should authenticate as a real test user (Supabase
Auth, same as the app itself) rather than bypass auth, since RLS
evaluation is explicitly part of what's being measured — see "RLS
query plans" below.

1. **Sign in** — `supabase.auth.signInWithPassword`, the same call
   `AuthContext.jsx` makes.
2. **Dashboard load** — the Season tab's real queries (the default,
   active tab): `season-metrics`, `season-purchases`, `season-monthly`,
   `season-stocks`, plus the always-on header queries
   (`actor-type-counts`, `beekeeper-aggregates`). This is the exact set
   confirmed earlier this session to fire on every real Dashboard
   visit.
3. **Transactions list** — a real, paginated `transactions` query via
   `.range()`, the same shape `TransactionsList.jsx` uses.
4. **Create a transaction** — a real insert through the same path
   `ReceiveStockForm.jsx` uses, direction included (the exact field
   whose absence caused a real, confirmed bug fixed earlier this
   session).
5. **Search/filter** — a transactions or beekeepers query with a
   realistic filter applied, not just an unfiltered list.

### Concurrency levels

Per this app's own stated target (10,000 registered users — not all
active at once): run each scenario at 100, 500, 1,000, and 2,000+
concurrent virtual users. k6's `stages` config ramps between these
cleanly in one script rather than needing four separate runs.

```javascript
export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '3m', target: 100 },
    { duration: '2m', target: 500 },
    { duration: '3m', target: 500 },
    { duration: '2m', target: 1000 },
    { duration: '3m', target: 1000 },
    { duration: '2m', target: 2000 },
    { duration: '3m', target: 2000 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2500'],
    http_req_failed: ['rate<0.01'],
  },
};
```

## What this plan would actually help confirm

- Whether the `transactions.owning_actor_id` index added earlier this
  session genuinely pays off at real scale, versus Postgres still
  preferring a sequential scan (confirmed via `EXPLAIN ANALYZE` to be
  the correct choice at today's real row count, but expected to flip
  as volume grows).
- Whether RLS evaluation itself — the actual bottleneck candidate
  flagged in the original audit's Phase 4 — holds up under real
  concurrent load, not just a single `EXPLAIN ANALYZE` run.
- Real throughput limits of this app's direct-to-Supabase architecture
  (no custom backend server sits between the app and the database),
  which is a materially different scaling profile than a traditional
  API-backed app and hasn't been tested under load at all.

## Not in scope here

This plan covers API/database load specifically. Frontend rendering
performance under load (many concurrent browser tabs) is a separate,
lower-priority concern given the architecture — most of the real work
happens server-side in Postgres via RLS-scoped queries, not
client-side.
