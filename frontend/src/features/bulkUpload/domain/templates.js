import { STANDARDS, PRODUCTS, CURRENCIES, UNITS } from '@/data/regions';

// Column definitions per target table. "required" fields must be present and non-empty on every row.
export const BULK_UPLOAD_TEMPLATES = {
  beekeepers: {
    label: 'Beekeeper Onboarding',
    table: 'beekeepers',
    uploadType: 'Connections', // matches bulk_uploads.upload_type CHECK constraint
    columns: [
      // Grouped for readability, per explicit request -- 7 real groups,
      // each column tagged with which one it belongs to so
      // downloadTemplate can render a real merged group-header row above
      // the column names, not just visual spacing.
      { key: 'full_name', label: 'Full name', required: true, group: 'Biographic data' },
      // Match key for the export/edit/re-import workflow: exported rows
      // carry their real, existing traceability code so re-uploading an
      // edited file updates that exact beekeeper instead of creating a
      // duplicate. Left blank on a row (a genuinely new beekeeper added
      // below the exported ones), it's simply ignored -- the existing
      // name+village matching below still applies as a fallback, and a
      // fresh code gets generated the normal way. Never itself written
      // by an insert/update -- see submit()'s handling.
      { key: 'traceability_code', label: 'Traceability code (leave blank for a new beekeeper)', required: false, group: 'Biographic data' },
      { key: 'gender', label: 'Gender', required: true, allowed: ['Male', 'Female'], group: 'Biographic data' },
      { key: 'year_of_birth', label: 'Year of birth', required: false, type: 'number', group: 'Biographic data' },
      { key: 'national_id', label: 'National ID', required: false, group: 'Biographic data' },
      { key: 'internal_code', label: 'Internal code', required: false, group: 'Biographic data' },
      // Plain free text per explicit request -- no longer a soft
      // dropdown against the real actor list.
      { key: 'linked_producer_organisation', label: 'Linked producer organisation', required: false, group: 'Biographic data' },

      { key: 'contact_phone', label: 'Contact number', required: true, group: 'Contact' },

      { key: 'country', label: 'Country', required: true, cascadeLevel: 'country', group: 'Geographic data' },
      { key: 'state_region', label: 'Region', required: true, cascadeLevel: 'state', group: 'Geographic data' },
      { key: 'lga_municipality', label: 'LGA', required: true, cascadeLevel: 'lga', group: 'Geographic data' },
      { key: 'village_name', label: 'Village', required: true, group: 'Geographic data' },

      // Three real Yes/No columns instead of one comma-separated Standards
      // column: a beekeeper can genuinely hold more than one standard at
      // once (Babs's own real feedback), and a single Excel dropdown can
      // only ever hold one selected value — this is the only way to keep
      // real, enforceable dropdowns while still allowing multiple real
      // values per beekeeper. atLeastOneOf groups these for validation:
      // the single-upload form requires at least one standard, matched
      // here rather than left looser just because it's a bulk upload.
      { key: 'standard_sustainable', label: 'Sustainable', required: true, allowed: ['Yes', 'No'], atLeastOneOf: 'standards', group: 'Standards' },
      { key: 'standard_organic', label: 'Organic', required: true, allowed: ['Yes', 'No'], atLeastOneOf: 'standards', group: 'Standards' },
      { key: 'standard_conventional', label: 'Conventional', required: true, allowed: ['Yes', 'No'], atLeastOneOf: 'standards', group: 'Standards' },
      // Conditionally required: only mandatory when Sustainable = Yes,
      // matching the single-upload form's own real rule exactly
      // (charterRequired = form.standards.includes('Sustainable')) rather
      // than being unconditionally required or unconditionally optional.
      { key: 'charter_signed', label: 'Sustainable Beekeeper charter approved', required: false, allowed: ['Yes', 'No'], requiredIf: { column: 'standard_sustainable', equals: 'Yes' }, group: 'Standards' },

      { key: 'commitment_crude_honey', label: 'Crude honey', required: true, allowed: ['Yes', 'No'], atLeastOneOf: 'commitment', group: 'Commitments' },
      { key: 'commitment_honey', label: 'Honey', required: true, allowed: ['Yes', 'No'], atLeastOneOf: 'commitment', group: 'Commitments' },
      { key: 'commitment_beeswax', label: 'Beeswax', required: true, allowed: ['Yes', 'No'], atLeastOneOf: 'commitment', group: 'Commitments' },

      { key: 'hives_traditional_single', label: 'Traditional single entry hives', required: false, type: 'number', emptyAs: 0, group: 'Hive' },
      { key: 'hives_traditional_double', label: 'Traditional double entries hives', required: false, type: 'number', emptyAs: 0, group: 'Hive' },
      { key: 'hives_modern', label: 'Modern hives', required: false, type: 'number', emptyAs: 0, group: 'Hive' },
      { key: 'hives_other', label: 'Other hives', required: false, type: 'number', emptyAs: 0, group: 'Hive' },

      { key: 'hive_cashew', label: 'Cashew', required: false, type: 'number', emptyAs: 0, group: 'Forages' },
      { key: 'hive_mango', label: 'Mango', required: false, type: 'number', emptyAs: 0, group: 'Forages' },
      { key: 'hive_shea', label: 'Shea', required: false, type: 'number', emptyAs: 0, group: 'Forages' },
      { key: 'hive_forest', label: 'Forest', required: false, type: 'number', emptyAs: 0, group: 'Forages' },
      { key: 'hive_other_forage', label: 'Other forage', required: false, type: 'number', emptyAs: 0, group: 'Forages' },
    ],
  },
  transactions: {
    label: 'Transactions',
    table: 'transactions',
    uploadType: 'Transactions',
    columns: [
      { key: 'transaction_date', label: 'Date (DD/MM/YYYY)', required: true, type: 'date' },
      { key: 'actor_code', label: 'Actor traceability code', required: false },
      { key: 'beekeeper_code', label: 'Beekeeper traceability code', required: false },
      { key: 'product', label: 'Product', required: true },
      { key: 'standard', label: 'Standard', required: true, allowed: STANDARDS },
      { key: 'quantity', label: 'Quantity', required: true, type: 'number' },
      { key: 'unit', label: 'Unit', required: false },
      { key: 'price', label: 'Price', required: true, type: 'number' },
      { key: 'direction', label: 'Direction', required: true, allowed: ['Received', 'Processing', 'Send'] },
    ],
  },
  contracts: {
    label: 'Contracts',
    table: 'contracts',
    uploadType: 'Contracts',
    columns: [
      { key: 'signature_date', label: 'Signature date (DD/MM/YYYY)', required: true, type: 'date' },
      { key: 'actor_code', label: 'Supplier actor traceability code', required: true },
      { key: 'standard', label: 'Standard', required: true, allowed: STANDARDS },
      { key: 'product', label: 'Product', required: true, allowed: PRODUCTS },
      { key: 'expected_quantity', label: 'Expected quantity', required: true, type: 'number' },
      { key: 'price', label: 'Maximum price', required: false, type: 'number' },
      { key: 'unit', label: 'Unit', required: true, allowed: UNITS },
      { key: 'currency', label: 'Currency', required: true, allowed: CURRENCIES },
      // Calculated, not user-entered: never read back from an uploaded
      // file. The real total_amount is already correctly calculated
      // server-side below (expected_quantity * price) regardless of
      // what this column's own Excel formula happens to show -- this
      // exists purely so someone filling in the spreadsheet can see the
      // real total as they go, matching the same pattern already built
      // for Receive Stock's Amount column.
      { key: 'total_amount', label: 'Total amount', required: false, computed: true, formula: { multiply: ['expected_quantity', 'price'] } },
      { key: 'advance_amount_paid', label: 'Advance amount paid', required: false, type: 'number' },
      { key: 'comments', label: 'Comments', required: false },
    ],
  },
  // Dedicated to ReceiveStockForm.jsx exactly -- that form only ever
  // creates beekeeper-sourced Received transactions (never sets actor_id,
  // never asks for a direction), unlike the broader `transactions`
  // template above which covers all three directions from either an
  // actor or a beekeeper. Kept both templates rather than replace one
  // with the other, since real historical-import use still needs the
  // broader shape.
  //
  // Real gap found via user report: Standard and Unit both used to be
  // per-row columns here too, exactly like the generic `transactions`
  // template above. But ReceiveStockForm already makes the person choose
  // one Standard before the multi-upload block even renders (`mode ===
  // 'multiple' && form.standard`) -- asking for it again on every row
  // was pure redundant re-entry of a value already fixed for the whole
  // batch. Unit was always meant to be "Kg" only, never a real per-row
  // choice (see the single-transaction form, which shows it as a fixed
  // label, not a field) -- carrying it as a blank, dropdown-less column
  // here was a leftover, not a real column. Both removed; the caller now
  // passes the chosen standard through submit()'s options, and unit is
  // hardcoded to 'Kg' at insert time (see submit() below).
  receiveStock: {
    label: 'Receive Stock',
    table: 'transactions',
    uploadType: 'Transactions',
    columns: [
      { key: 'transaction_date', label: 'Date (DD/MM/YYYY)', required: true, type: 'date' },
      { key: 'beekeeper_code', label: 'Beekeeper traceability code', required: true },
      { key: 'product', label: 'Product', required: true, allowed: PRODUCTS },
      { key: 'quantity', label: 'Quantity (Kg)', required: true, type: 'number' },
      // Key stays 'price' to match the real transactions.price column --
      // only the visible label changed.
      { key: 'price', label: 'Unit price', required: false, type: 'number' },
      { key: 'currency', label: 'Currency', required: true, allowed: CURRENCIES },
      // Calculated, not user-entered: never read back from an uploaded
      // file (skipped entirely by both the required-field check and the
      // parsed-data mapping). The real total_amount is always
      // recalculated server-side from quantity * price regardless
      // (existing, established rule for every transaction template --
      // "never treat Excel formulas as the source of truth") -- this
      // column exists purely so someone filling in the spreadsheet can
      // see the real total as they go, via a genuine Excel formula, not
      // a static example number that goes stale the moment they change
      // Quantity or Unit price.
      { key: 'amount', label: 'Amount', required: false, computed: true, formula: { multiply: ['quantity', 'price'] } },
    ],
  },
};
