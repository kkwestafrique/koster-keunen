import { calculateAdvancePercent } from '@/lib/contractMath';
import { parseBulkUploadDate } from '@/lib/dateParsing';
import { buildNormalizedRowLookup, getRowValue } from './headers';
import { ORIGINAL_ROW_INDEX_KEY } from './constants';

export function validateRows(rows, template, lookups, isHistorical) {
  return rows.map((row, index) => {
    const errors = [];
    const cleaned = {};
    const rowLookup = buildNormalizedRowLookup(row);

    template.columns.forEach((col) => {
      // Calculated columns (e.g. Amount) are never read from the
      // uploaded file at all -- the real total is always recalculated
      // server-side below from quantity and price, so trying to parse
      // whatever a spreadsheet formula happened to cache would be both
      // pointless and risky (a stale or hand-edited value could
      // silently disagree with the real quantity/price on the same row).
      if (col.computed) return;

      let value = getRowValue(rowLookup, col);
      if (typeof value === 'string') value = value.trim();

      if (col.required && (value === '' || value === undefined || value === null)) {
        errors.push(`${col.label} is required`);
      }

      if (col.type === 'date' && value !== '' && value !== undefined && value !== null) {
        // Real date parsing, not a loose pass-through -- the database
        // needs a real ISO date, and the heading explicitly promises
        // DD/MM/YYYY. Handles both shapes Excel actually hands over
        // (a text string, or a raw date serial number when Excel
        // auto-converted a typed date) -- see lib/dateParsing.js for
        // the full reasoning and the sanity range on serials.
        const parsedDate = parseBulkUploadDate(value);
        if (parsedDate.error) {
          errors.push(`${col.label} ${parsedDate.error}`);
        } else {
          value = parsedDate.iso;
        }
      }

      if (col.type === 'array') {
        const items = value === '' ? [] : String(value).split(',').map((s) => s.trim()).filter(Boolean);
        if (col.allowed) {
          const bad = items.filter((i) => !col.allowed.includes(i));
          if (bad.length) errors.push(`${col.label}: "${bad.join(', ')}" must be one of: ${col.allowed.join(', ')}`);
        }
        cleaned[col.key] = items;
        return;
      }

      if (col.type === 'boolean') {
        const normalized = String(value).trim().toLowerCase();
        cleaned[col.key] = ['yes', 'true', '1'].includes(normalized);
        return;
      }

      if (col.allowed && value && !col.allowed.includes(value)) {
        errors.push(`${col.label} must be one of: ${col.allowed.join(', ')}`);
      }
      if (col.type === 'number' && value !== '' && isNaN(Number(value))) {
        errors.push(`${col.label} must be a number`);
      }

      // Real bug, found in this app's own upload log: every optional
      // number column (year of birth, hive and forage counts) sent "" to
      // Postgres when left blank, which rejects it ("invalid input
      // syntax for type integer"). One blank cell failed the whole
      // insert batch, so new beekeepers silently didn't save. Blank now
      // means the column's real empty value: 0 for counts (their DB
      // default; forage columns are NOT NULL), null otherwise (e.g.
      // year of birth, which has no default).
      const isBlank = value === '' || value === undefined || value === null;
      const numericValue = col.type === 'number'
        ? (isBlank ? (col.emptyAs ?? null) : Number(value))
        : value;

      // Resolve text codes/names to the real FK columns instead of storing
      // them verbatim under a column name the table doesn't have.
      // Real gap found via user report: single-add (AddBeekeeperDialog,
      // DetailsTab) already auto-creates a village on the fly the moment
      // someone types a genuinely new one (useFindOrCreateVillage) --
      // bulk upload was the only place a new-but-real village name
      // caused a hard failure ("not found... hasn't been added to the
      // app yet"), even though that's exactly the flow someone bulk-
      // onboarding beekeepers from a village never entered before would
      // hit immediately. No longer blocks the row; resolution (find or
      // create) now happens in submit(), same matching rule as
      // useFindOrCreateVillage (case-insensitive, trimmed, same
      // country/state/lga).
      if (col.key === 'village_name') {
        if (value) {
          const key = [value, cleaned.country, cleaned.state_region, cleaned.lga_municipality].map((s) => String(s || '').toLowerCase()).join('|');
          const id = lookups.villagesByName[key];
          cleaned.village_id = id || null;
          if (!id) {
            const trimmed = String(value).trim();
            // Same minimum-length rule useFindOrCreateVillage already
            // enforces for single-add, applied here too -- without it, a
            // stray one-character typo in a bulk file would silently
            // create a junk village row instead of the single bad row
            // just failing, and at bulk volume that's a much bigger
            // data-quality risk than the single-add case this rule was
            // originally written for.
            if (trimmed.length < 2) {
              errors.push(`Village "${value}" is too short to be a real village name (at least 2 characters)`);
            } else {
              cleaned._newVillageName = trimmed;
            }
          }
        }
      } else if (col.key === 'actor_code') {
        if (value) {
          // The dropdown's real option text is "code - Name" (that's what
          // gets written to the cell when someone actually selects it),
          // but the lookup table is keyed by the bare code alone --
          // strip everything from the first " - " onward before
          // matching. Falls back to the whole value unchanged if there's
          // no " - " at all, so someone who manually typed just the
          // code still resolves correctly too.
          const code = String(value).split(' - ')[0].trim();
          const id = lookups.actorsByCode[code.toLowerCase()];
          if (!id) errors.push(`Actor code "${value}" not found`);
          cleaned.actor_id = id || null;
        }
      } else if (col.key === 'beekeeper_code') {
        if (value) {
          const code = String(value).split(' - ')[0].trim();
          const id = lookups.beekeepersByCode[code.toLowerCase()];
          if (!id) errors.push(`Beekeeper code "${value}" not found`);
          cleaned.beekeeper_id = id || null;
        }
      } else {
        cleaned[col.key] = numericValue;
      }
    });

    // Received transactions need a resolved beekeeper; Send needs a
    // resolved actor — cross-check now that direction is known.
    if (template.table === 'transactions') {
      if (cleaned.direction === 'Received' && !cleaned.beekeeper_id) {
        errors.push('Beekeeper traceability code is required for Received transactions');
      }
      if (cleaned.direction === 'Send' && !cleaned.actor_id) {
        errors.push('Actor traceability code is required for Send transactions');
      }
      // total_amount is never trusted from the file itself (a formula
      // cell, or a value someone typed by hand, could easily be wrong or
      // stale) — always recomputed here from the row's own quantity and
      // price, matching the spec's explicit requirement to never treat
      // Excel formulas as the source of truth.
      if (typeof cleaned.quantity === 'number' && typeof cleaned.price === 'number') {
        cleaned.total_amount = cleaned.quantity * cleaned.price;
      }
      // Historical import re-uses this same template/column shape (per
      // product owner's call) but only Received and Send map cleanly onto
      // it -- Processing needs a separate source vs. destination product,
      // which this flat template has no columns for. Rather than silently
      // mis-handling those rows, reject them clearly.
      if (isHistorical && cleaned.direction === 'Processing') {
        errors.push('Historical import does not support Processing rows yet — only Received and Send');
      }
      // Same explicit status as the single-transaction forms: Send is
      // auto-Approved at creation, Received (and Processing, which has no
      // status badge either way) start Pending so the Approve/Reject
      // workflow on the detail page actually has something to act on —
      // never rely on the table's own default here (confirmed bug:
      // defaults to 'Approved' for everything, which silently skips the
      // whole approval step for bulk-uploaded Received rows too). Historical
      // rows are an explicit exception: they're already-completed past
      // records, so they land Approved immediately, same as Send.
      cleaned.status = (cleaned.direction === 'Send' || isHistorical) ? 'Approved' : 'Pending';
    }

    // Historical Contracts import: one row = one contract (one product,
    // its own contract_group_id) — matches the single-Contract-per-product
    // shape useCreateContract() already produces, just skipping the
    // interactive wizard. contract_code/owning_actor_id are both set by
    // existing triggers on insert, same as the normal creation path.
    if (template.table === 'contracts') {
      if (!cleaned.actor_id) errors.push('Supplier actor traceability code is required');
      const parsedDate = cleaned.signature_date ? new Date(cleaned.signature_date) : null;
      cleaned.year = parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.getFullYear() : new Date().getFullYear();
      cleaned.contract_type = 'Send';
      cleaned.advance_amount_paid = cleaned.advance_amount_paid || 0;
      if (typeof cleaned.expected_quantity === 'number' && typeof cleaned.price === 'number') {
        cleaned.total_amount = cleaned.expected_quantity * cleaned.price;
        cleaned.advance_percent = calculateAdvancePercent(cleaned.total_amount, cleaned.advance_amount_paid);
      }
      cleaned.contract_group_id = crypto.randomUUID();
    }

    // Beekeepers: converts the individual Yes/No standard_*/commitment_*
    // columns (real, separate Excel dropdowns, since a beekeeper can
    // genuinely hold more than one standard/commitment at once, and a
    // single dropdown can only ever hold one value) back into the real
    // standards/commitment arrays the beekeepers table actually has, and
    // enforces the two cross-column rules the generic per-column loop
    // above can't express on its own: at least one Yes per atLeastOneOf
    // group, and charter_signed only actually required when
    // standard_sustainable is Yes -- both matching AddBeekeeperDialog's
    // own real validation exactly (charterRequired =
    // form.standards.includes('Sustainable')), not a looser bulk-only
    // rule.
    if (template.table === 'beekeepers') {
      const groups = {};
      template.columns.filter((c) => c.atLeastOneOf).forEach((c) => {
        const isYes = String(cleaned[c.key]).trim().toLowerCase() === 'yes';
        (groups[c.atLeastOneOf] = groups[c.atLeastOneOf] || []).push({ col: c, isYes });
      });
      Object.entries(groups).forEach(([groupName, members]) => {
        if (!members.some((m) => m.isYes)) {
          errors.push(`At least one of ${members.map((m) => m.col.label).join(', ')} must be "Yes"`);
        }
      });
      cleaned.standards = template.columns
        .filter((c) => c.atLeastOneOf === 'standards' && String(cleaned[c.key]).trim().toLowerCase() === 'yes')
        .map((c) => c.label);
      cleaned.commitment = template.columns
        .filter((c) => c.atLeastOneOf === 'commitment' && String(cleaned[c.key]).trim().toLowerCase() === 'yes')
        .map((c) => c.label);

      // Must run before the delete loop below -- this reads
      // cleaned[requiredIf.column] (e.g. standard_sustainable), which
      // that same delete loop removes right after. Real bug caught by a
      // direct test before shipping: with the check placed after the
      // delete, the trigger column was always already gone, so this
      // never actually fired for any row, ever.
      const charterCol = template.columns.find((c) => c.key === 'charter_signed');
      if (charterCol?.requiredIf) {
        const triggerValue = String(cleaned[charterCol.requiredIf.column]).trim().toLowerCase();
        const triggered = triggerValue === charterCol.requiredIf.equals.toLowerCase();
        if (triggered && String(cleaned.charter_signed || '').trim() === '') {
          errors.push(`${charterCol.label} is required when Sustainable is Yes`);
        }
      }

      template.columns.filter((c) => c.atLeastOneOf).forEach((c) => { delete cleaned[c.key]; });
      cleaned.charter_signed = String(cleaned.charter_signed).trim().toLowerCase() === 'yes';

      // Real, root-cause bug found via thorough investigation: country,
      // state_region, and lga_municipality are only ever needed to
      // resolve village_id above (see the village_name handling in the
      // per-column loop) -- beekeepers has no such columns of its own
      // at all, that data lives entirely through the village_id
      // relationship. Left in cleaned, these three were never stripped
      // before insert/update, so every single beekeeper bulk upload --
      // new or updating an existing one -- failed at the actual
      // database call with "column ... does not exist", even though
      // validation itself showed a clean "row(s) verified" with zero
      // errors. Confirmed directly: reproduced the real error against
      // the database with real, transformed row data before this fix.
      delete cleaned.country;
      delete cleaned.state_region;
      delete cleaned.lga_municipality;
    }

    // row.__originalRowIndex (set by parseFile's blank-row filter) is the
    // row's real position in the original file. Falls back to the
    // array's own index if it's ever missing, so this never throws --
    // not because a specific other caller is known to need it.
    const realIndex = row[ORIGINAL_ROW_INDEX_KEY] ?? index;
    return { rowNumber: realIndex + 2, data: cleaned, errors };
  });
}
