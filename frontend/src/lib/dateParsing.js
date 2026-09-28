import * as XLSX from 'xlsx';

// Bulk-upload date cells arrive in one of two real shapes, confirmed
// empirically against the exact sheet_to_json options this app uses:
//
//   1. A text string -- what a Text-formatted cell holds, or a value the
//      user typed that Excel left alone. Must be DD/MM/YYYY (the
//      explicitly specified format; dashes are deliberately not
//      accepted).
//   2. A raw Excel date serial number (e.g. 46037 for 15/01/2026) --
//      what Excel commonly converts a typed date into when the cell is
//      General-formatted, especially on a day-first-locale machine, and
//      also what pasting dates from another sheet produces. The app
//      previously only understood case 1, so someone typing exactly
//      "15/01/2026" could still be told the format was wrong, because
//      the app never actually saw their slashes -- it saw 46037.
//
// Returns { iso: 'YYYY-MM-DD' } on success or { error: '<reason>' } on
// failure; every error string reads naturally after the column label
// (the caller composes `${label} ${error}`). Always
// converts to ISO, because the database's date columns reject
// "15/01/2026" outright (Postgres reads it as month 15).

// A serial number is only meaningfully a date if it lands in a sane
// range. Without this, a small number typed into the wrong column --
// a quantity like 590, say, which is a valid serial (mid-1901) --
// would silently become a nonsense date instead of an error. 1990 is
// a deliberately generous floor for an app whose real data is recent.
const MIN_YEAR = 1990;
const MAX_YEAR = 2100;

const pad = (n) => String(n).padStart(2, '0');

export function parseBulkUploadDate(value) {
  if (typeof value === 'number') {
    const parts = XLSX.SSF.parse_date_code(value);
    if (!parts || parts.y < MIN_YEAR || parts.y > MAX_YEAR) {
      return { error: `is not a valid date: "${value}"` };
    }
    return { iso: `${parts.y}-${pad(parts.m)}-${pad(parts.d)}` };
  }

  const match = String(value).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return { error: 'must be in DD/MM/YYYY format' };

  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  const isRealDate = parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
  if (!isRealDate) return { error: `is not a real date: "${value}"` };
  return { iso: `${year}-${pad(month)}-${pad(day)}` };
}
