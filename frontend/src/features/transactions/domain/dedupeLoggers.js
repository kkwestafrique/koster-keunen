// "Person" filter on transaction lists: only staff who've actually logged a
// transaction, not every team member. Pure de-duplication by user id, keeping the
// first username seen for each.
export function dedupeLoggers(rows) {
  const seen = new Map();
  rows.forEach((r) => {
    if (r.user_accounts && !seen.has(r.user_accounts.id)) {
      seen.set(r.user_accounts.id, r.user_accounts.username);
    }
  });
  return Array.from(seen, ([value, label]) => ({ value, label }));
}
