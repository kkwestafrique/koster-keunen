# Scripts

Standalone maintenance/test scripts — not part of the frontend build, so they have their own `package.json` and `node_modules`.

## smoke-test.js

Automated regression tests for the bugs that were most expensive to find by hand this session (silent multi-product insert failures, RLS/storage tenant isolation, Report query crashes). Creates its own throwaway test data and deletes it all when done — safe to run repeatedly against the real project.

### Setup (one-time)

```
cd scripts
npm install
```

### Get your service-role key

The frontend's `.env` deliberately never has this (it must never ship to the browser). Grab it from:

**Supabase dashboard → Settings → API → `service_role` `secret`**

### Run

```
SUPABASE_SERVICE_ROLE_KEY=your_key_here node smoke-test.js
```

(It reads `REACT_APP_SUPABASE_URL` / `REACT_APP_SUPABASE_ANON_KEY` from `frontend/.env` automatically — you only need to supply the service-role key on the command line, so it's never saved to a file by accident.)

### What a failure looks like

Each check prints ✓ or ✗ with a one-line reason. A ✗ means something in the database/schema itself has regressed — re-run the exact SQL/logic mentioned in that check's name manually via the Supabase SQL editor to confirm before assuming the script itself is wrong.
