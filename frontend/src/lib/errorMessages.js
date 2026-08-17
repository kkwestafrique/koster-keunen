// Gap 18: 16 places across the app showed raw backend error text directly
// to the end user -- the same category of problem as the real platform's
// documented issue (unfiltered internal error detail reaching someone who
// can't act on it and shouldn't see it), even though it's not literally a
// Python stack trace here.
//
// This is deliberately NOT a blanket "always show something generic"
// filter. Many of the errors thrown across this app are custom, deliberately-
// written RAISE EXCEPTION messages from this project's own Postgres
// functions (e.g. "Not authorized to reject this transaction", "This
// person already belongs to another actor..."), written specifically to
// be clear and actionable -- hiding those would make things worse, not
// better. The real problem is specifically raw Postgres SYSTEM error text
// (RLS policy names, constraint names, technical jargon) leaking through
// unfiltered. This only replaces the patterns that are recognizably raw
// system errors; everything else passes through unchanged.

const RAW_ERROR_PATTERNS = [
  { match: /row-level security policy/i, friendly: "You don't have permission to make this change." },
  { match: /violates foreign key constraint/i, friendly: 'This record is linked to other data and cannot be changed that way.' },
  { match: /violates unique constraint/i, friendly: 'That value is already in use -- please use a different one.' },
  { match: /violates not-null constraint/i, friendly: 'A required field is missing.' },
  { match: /violates check constraint/i, friendly: 'One of the values entered is not valid.' },
  { match: /duplicate key value/i, friendly: 'That value is already in use -- please use a different one.' },
  { match: /JWT|jwt expired|invalid token/i, friendly: 'Your session has expired -- please refresh the page and try again.' },
  { match: /permission denied for/i, friendly: "You don't have permission to do this." },
];

export function getFriendlyErrorMessage(err) {
  const raw = err?.message || String(err);
  for (const { match, friendly } of RAW_ERROR_PATTERNS) {
    if (match.test(raw)) return friendly;
  }
  // Not a recognized raw-system-error pattern -- most likely one of this
  // project's own deliberately-written, human-readable exception messages.
  // Pass it through as-is.
  return raw;
}
