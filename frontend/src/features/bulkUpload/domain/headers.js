import { ORIGINAL_ROW_INDEX_KEY } from './constants';

// Real gap found and fixed: header matching was exact and case-sensitive
// (row[col.label] ?? row[col.key]), so a file with "Full Name" instead of
// the template's own "Full name" would silently fail to match at all --
// the field would be treated as empty, showing a confusing "required"
// error for data that was genuinely there, just under a slightly
// different-cased header. Normalizes case and collapses whitespace before
// comparing, so small real-world formatting differences (a report
// exported with Title Case headers, a header with extra trailing spaces)
// don't silently break an otherwise-valid upload.
export function normalizeHeader(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function buildNormalizedRowLookup(row) {
  const map = new Map();
  Object.keys(row).forEach((k) => map.set(normalizeHeader(k), row[k]));
  return map;
}

export function getRowValue(rowLookup, col) {
  return rowLookup.get(normalizeHeader(col.label)) ?? rowLookup.get(normalizeHeader(col.key)) ?? '';
}

// Real gap found and fixed: nothing ever told a person their file might
// be the wrong one entirely (e.g. a downloaded report used by mistake
// instead of the real upload template) -- columns the template doesn't
// recognize were just silently ignored, with zero indication anything
// was wrong.
export function detectUnrecognizedColumns(rawRows, template) {
  if (rawRows.length === 0) return [];
  const knownNormalized = new Set(
    template.columns.flatMap((c) => [normalizeHeader(c.label), normalizeHeader(c.key)])
  );
  const realHeaders = Object.keys(rawRows[0]).filter((h) => h !== ORIGINAL_ROW_INDEX_KEY);
  return realHeaders.filter((h) => !knownNormalized.has(normalizeHeader(h)));
}
