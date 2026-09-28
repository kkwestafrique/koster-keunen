// Pure helpers for turning per-row validation results into the short text stored
// on a bulk_uploads history row. Previously duplicated inline in two places.

const DEFAULT_LIMIT = 5;

// "Row 4: <first error>" for each invalid row, capped -- error_detail is a short
// summary, not a full log.
export function summarizeRowErrors(rows, limit = DEFAULT_LIMIT) {
  return rows
    .map((r) => (r.errors.length > 0 ? `Row ${r.rowNumber}: ${r.errors[0]}` : null))
    .filter(Boolean)
    .slice(0, limit);
}

// null when there is nothing to report, otherwise the first `limit` joined for storage.
export function formatErrorDetail(errors, limit = DEFAULT_LIMIT) {
  return errors.length > 0 ? errors.slice(0, limit).join(' | ') : null;
}
