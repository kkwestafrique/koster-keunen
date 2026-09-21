# Checklist: writing or editing a SECURITY DEFINER function or RLS policy

## Why this exists

In one security-audit pass on this codebase, 5 of the 6 real bugs found
were authorization bugs — not five unrelated mistakes, but the same
missing step, repeated five times: `lookup_actor_by_connect_id` leaking
full PII cross-tenant, team-member removal never actually revoking
access, an unused `user_accounts` insert policy with no role
restriction, report exports downloadable by anyone in the tenant
regardless of role, and (from an earlier pass) `browse_actor_directory`
leaking every actor's email and phone.

Every one of these passed the test "does this work for the feature I'm
building?" None were checked against a fixed set of questions before
shipping. Detection is unbounded and reactive — an unaudited function
stays a risk until someone happens to look at it. This checklist is
bounded and one-time: apply it once per function, before it ships, and
it covers that function forever.

**Use this before merging any new or edited `SECURITY DEFINER`
function, RLS policy, or storage policy.**

---

## The checklist

### 1. Minimum data
What's the *actual minimum* this needs to return — not what's
convenient, what's genuinely used by the real caller(s)?

> `lookup_actor_by_connect_id` returned full contact_email,
> contact_phone, and complete address. The only real frontend caller
> (`ActorFormDialog.jsx`) used exactly 4 fields: id, contact_name,
> actor_type, country. The rest was pure, unused over-fetching — fully
> present in the API response, fully extractable, never rendered.
>
> **Check the real caller's code before deciding the shape. Don't
> guess what "seems useful."**

### 2. Tenant scope
Is there a `supply_chain_id` (or equivalent tenant) condition, and is
it enforced *in the query itself* — not assumed, not inherited from
"well, RLS handles that elsewhere"?

> `lookup_actor_by_connect_id` had zero tenant scoping. Its only real
> gate was "is logged in." Any authenticated user, from any tenant,
> could call it with any actor's real `connect_id`.

### 3. Real source of truth
What table/column *actually* controls the permission this touches —
and does this function touch that one, or a different one that merely
looks related?

> Removing a team member deleted the `team_members` row. But every
> function that actually gates access (`auth_role()`,
> `auth_current_actor_id()`, `auth_supply_chain_id()`) reads solely
> from `user_accounts`, never `team_members`. The row that got deleted
> was never consulted by anything that controls real access — "removal"
> changed nothing about what the person could actually do.

### 4. Every write path, not just the obvious one
If this is an `INSERT`/`UPDATE` policy: what values can the caller put
in the row, not just which rows can they touch?

> `user_accounts_self_insert` correctly restricted *which* `id` could
> be inserted (had to match the caller's own `auth.uid()`) but placed
> zero restriction on `role` or `supply_chain_id`. A real account could
> have self-assigned `role = 'Admin'` on any tenant.

### 5. Reused code, re-scoped for the new case
If this function/policy is being reused for a new feature: does the
old scope still make sense here, or did the new case need something
narrower?

> The storage policy for `private-media` was correctly tenant-scoped
> for transaction/contract attachments (meant to be visible to anyone
> who can see the parent record). Report exports were added under the
> same bucket, same policy — but exports can contain tenant-wide data a
> Field Officer or Member would never normally see. The old scope was
> right for attachments and wrong for exports; nobody re-asked the
> question for the new case.

### 6. Tested live, as the real, restricted user
Not read, not reasoned about — actually run, as a real account that
should be denied, in a transaction you roll back.

**This is the step that actually catches the others.** Every bug above
was found this way, not by re-reading the SQL. Use this pattern:

```sql
begin;
set local role authenticated;
set local request.jwt.claim.sub = '<a real, low-privilege, unrelated user id>';

-- Call the real function, or select from the real table, exactly as
-- the low-privilege user would.
select * from lookup_actor_by_connect_id('<a real connect_id you should not have access to>');

rollback;  -- always roll back; nothing here should persist
```

If you're testing a write (insert/update/delete), verify by checking
the row's real state *inside the same transaction*, before the
rollback — an error is one signal, but a silent no-op or an
unexpectedly-successful write is just as important to catch.

Test both directions:
- **Should be denied:** confirm it actually is (an error, or zero rows
  — not just "the UI doesn't show a button for it")
- **Should be allowed:** confirm the fix didn't accidentally break the
  real, legitimate case (e.g. an Admin who should still see everything)

---

## What this checklist does not replace

- Real regression tests for the specific bugs already found (separate,
  ongoing work)
- A second pair of eyes on genuinely high-stakes changes
- Testing cross-tenant isolation specifically, which needs a second,
  real tenant to test against (this database is currently
  single-tenant in production, so that specific check has to wait for
  one to exist, or use a disposable test branch)

This checklist exists to catch the *pattern* — under-scoped data,
missing tenant checks, mismatched source of truth — before it ships,
not to be the only safeguard.
