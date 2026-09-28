import { normalizeHeader } from './headers';
import { ORIGINAL_ROW_INDEX_KEY } from './constants';

// Pure: drops rows that are Excel formatting bleed (every non-computed cell blank)
// and tags each survivor with its true position in the source sheet so row
// numbers in error messages still point at the right physical row.
export function filterBlankRows(rows, template) {
  // Real, systemic gap found via user reports across every
  // template (receiveStock: "499 row(s) with errors" from a file
  // with only a couple of real rows filled in; contracts: "489
  // row(s) with errors" showing the identical pattern) --
  // `defval: ''` makes sheet_to_json produce a full row object
  // for every row within the worksheet's used range, not just
  // rows that actually have data. Every template pre-formats
  // ~500 rows with real dropdown data-validation (a genuinely
  // useful technique -- it's why the dropdowns keep working as
  // someone scrolls down and keeps typing), so anyone who fills
  // in just their real rows and leaves the rest untouched gets
  // hundreds of phantom "row(s) with errors" for cells that were
  // never meant to hold data at all. A row where every single
  // cell is blank (after trimming) is Excel formatting bleed,
  // not a real data row -- dropped here, before validateRows
  // ever sees it, rather than validated and then explained away.
  // Computed/formula columns (e.g. contracts' Total amount,
  // receiveStock's Amount) always evaluate to a real value --
  // typically 0 -- even on a row with nothing else in it, since
  // that's how spreadsheet formulas work on blank inputs. Left
  // in the blank-check below, a single computed column's "0"
  // would count as "this row has data" and defeat the whole
  // filter for exactly the two templates that have one -- which
  // is exactly what was still happening for Contracts and
  // Receive Stock after the fix above, even though it worked
  // immediately for Beekeepers (no computed columns there).
  // Excluded by normalized label/key so it matches however
  // sheet_to_json actually named this column's key.
  const computedHeaderKeys = new Set(
    (template?.columns || []).filter((c) => c.computed).flatMap((c) => [normalizeHeader(c.label), normalizeHeader(c.key)])
  );
  return rows
    .map((row, idx) => ({
      row,
      idx,
      isBlank: !Object.entries(row).some(([k, v]) => !computedHeaderKeys.has(normalizeHeader(k)) && String(v ?? '').trim() !== ''),
    }))
    .filter((r) => !r.isBlank)
    .map((r) => ({ ...r.row, [ORIGINAL_ROW_INDEX_KEY]: r.idx }));
}
