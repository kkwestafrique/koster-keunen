// Real feedback: "Please change all date format to: DD-MM-YYYY."
// Dates come back from Postgres as either a plain date string
// ("2026-08-27") or a full ISO timestamp ("2026-08-27T14:03:11+00:00").
// Both need to render consistently as DD-MM-YYYY across the app,
// instead of the previous mix of raw ISO strings (YYYY-MM-DD) and
// browser-locale-dependent .toLocaleDateString()/.toLocaleString()
// calls, which could show mm/dd/yyyy, dd/mm/yyyy, or something else
// entirely depending on the viewer's own device settings.
//
// Deliberately does NOT touch native <input type="date"> pickers --
// those are rendered directly by the browser using the browser's own
// locale, and there is no way to force a specific display format on
// them without replacing every one with a custom date-picker component
// (a much bigger change than a formatting fix). The underlying value
// stored and submitted by a date input is always YYYY-MM-DD regardless
// of how the browser chooses to display it, so this is a display-only
// limitation, not a data-correctness one.
export function formatDate(dateInput) {
  if (!dateInput) return null;
  const iso = typeof dateInput === 'string' ? dateInput : String(dateInput);
  // Plain date strings ("2026-08-27") -- parse directly from the string
  // to avoid any timezone shifting new Date() could introduce for a
  // date-only value.
  const dateOnlyMatch = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return `${day}-${month}-${year}`;
  }
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = String(parsed.getMonth() + 1).padStart(2, '0');
  const year = parsed.getFullYear();
  return `${day}-${month}-${year}`;
}

// For timestamps where the time also matters (Activity Log, Change
// History) -- same DD-MM-YYYY date portion, plus a plain 24-hour time.
export function formatDateTime(dateInput) {
  if (!dateInput) return null;
  const parsed = new Date(dateInput);
  if (Number.isNaN(parsed.getTime())) return null;
  const datePart = formatDate(dateInput);
  const hours = String(parsed.getHours()).padStart(2, '0');
  const minutes = String(parsed.getMinutes()).padStart(2, '0');
  return `${datePart} ${hours}:${minutes}`;
}
