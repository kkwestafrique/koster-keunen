import { useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { calculateAdvancePercent } from '@/lib/contractMath';
import ExcelJS from 'exceljs';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { STANDARDS, COMMITMENT_OF_BEEKEEPER, PRODUCTS, CURRENCIES, UNITS } from '@/data/regions';

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

      { key: 'hives_traditional_single', label: 'Traditional single entry hives', required: false, type: 'number', group: 'Hive' },
      { key: 'hives_traditional_double', label: 'Traditional double entries hives', required: false, type: 'number', group: 'Hive' },
      { key: 'hives_modern', label: 'Modern hives', required: false, type: 'number', group: 'Hive' },
      { key: 'hives_other', label: 'Other hives', required: false, type: 'number', group: 'Hive' },

      { key: 'hive_cashew', label: 'Cashew', required: false, type: 'number', group: 'Forages' },
      { key: 'hive_mango', label: 'Mango', required: false, type: 'number', group: 'Forages' },
      { key: 'hive_shea', label: 'Shea', required: false, type: 'number', group: 'Forages' },
      { key: 'hive_forest', label: 'Forest', required: false, type: 'number', group: 'Forages' },
      { key: 'hive_other_forage', label: 'Other forage', required: false, type: 'number', group: 'Forages' },
    ],
  },
  transactions: {
    label: 'Transactions',
    table: 'transactions',
    uploadType: 'Transactions',
    columns: [
      { key: 'transaction_date', label: 'Date', required: true },
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
      { key: 'signature_date', label: 'Signature date', required: true },
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
      { key: 'transaction_date', label: 'Date (DD-MM-YYYY)', required: true, type: 'date' },
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

const NAVY = 'FF032B71';
const BLUE = 'FF0F48AA';
const AMBER_FILL = 'FFFFF3CD';
const WHITE = 'FFFFFFFF';

// Columns whose real, valid values come from live app data, not a fixed
// list — fetched fresh every time someone downloads the template (not
// baked in once and left to go stale), so a supplier added to the app
// yesterday is already selectable in today's download.
async function fetchDynamicOptions(supplyChainId, columns, filters = {}) {
  const options = {};
  if (columns.some((c) => c.key === 'actor_code')) {
    const { data, error } = await supabase.rpc('browse_actor_directory');
    if (error) throw error;
    options.actor_code = (data || [])
      .filter((a) => a.traceability_code)
      .map((a) => `${a.traceability_code} - ${a.contact_name}`);
  }
  if (columns.some((c) => c.key === 'beekeeper_code')) {
    let query = supabase.from('beekeepers')
      .select('traceability_code, full_name')
      .eq('supply_chain_id', supplyChainId);
    // Real gap found via user report: with Standard chosen once up front
    // (ReceiveStockForm's multi-upload block only renders after
    // form.standard is set), the beekeeper list handed to this template
    // was still every beekeeper regardless of standard -- offering
    // beekeepers the person couldn't actually pick for a batch already
    // locked to one standard. `.contains` on the real standards array,
    // same column the single-transaction form's own beekeeper picker
    // already filters by.
    if (filters.standard) query = query.contains('standards', [filters.standard]);
    const { data, error } = await query;
    if (error) throw error;
    options.beekeeper_code = (data || [])
      .filter((b) => b.traceability_code)
      .map((b) => `${b.traceability_code} - ${b.full_name}`);
  }
  if (columns.some((c) => c.cascadeLevel === 'country')) {
    const { data, error } = await supabase.from('regions').select('country, level, name, parent_name, sort_order');
    if (error) throw error;
    options.regions = data || [];
  }
  if (columns.some((c) => c.softDropdown === 'producerOrganisations')) {
    const { data, error } = await supabase.rpc('browse_actor_directory');
    if (error) throw error;
    options.producerOrganisations = (data || [])
      .filter((a) => a.actor_type === 'Producer Organisation')
      .map((a) => a.contact_name);
  }
  return options;
}

// Builds the cascading Country -> Region -> LGA dropdown structure on the
// hidden Lists sheet: a plain Countries list, a Country-name -> index
// lookup table, one named range per country listing its regions, a
// Region-name -> index lookup table (keyed by "country|region" since two
// different countries can share a region name), and one named range per
// region listing its LGAs. Index-based rather than sanitizing real names
// (accents, apostrophes, spaces) into named-range-safe identifiers --
// verified directly that a real accented name like "Côte d'Ivoire" works
// cleanly this way, and that trying to sanitize it into a valid Excel
// name would have been real, unnecessary extra complexity.
function buildRegionCascade(listsSheet, regionsData, startCol) {
  let col = startCol;
  const countries = [...new Set(regionsData.map((r) => r.country))].sort();
  const countryCol = listsSheet.getColumn(col).letter;
  countries.forEach((c, i) => { listsSheet.getCell(`${countryCol}${i + 1}`).value = c; });
  listsSheet.workbook.definedNames.add(`Lists!$${countryCol}$1:$${countryCol}$${countries.length}`, 'Countries_list');
  col += 1;

  const countryLookupCol1 = listsSheet.getColumn(col).letter;
  const countryLookupCol2 = listsSheet.getColumn(col + 1).letter;
  countries.forEach((c, i) => {
    listsSheet.getCell(`${countryLookupCol1}${i + 1}`).value = c;
    listsSheet.getCell(`${countryLookupCol2}${i + 1}`).value = i + 1;
  });
  listsSheet.workbook.definedNames.add(`Lists!$${countryLookupCol1}$1:$${countryLookupCol2}$${countries.length}`, 'Country_index_lookup');
  col += 2;

  const regionLookupRows = [];
  countries.forEach((country, countryIdx) => {
    const states = [...new Set(regionsData.filter((r) => r.country === country && r.level === 'state').map((r) => r.name))];
    const stateCol = listsSheet.getColumn(col).letter;
    states.forEach((s, i) => { listsSheet.getCell(`${stateCol}${i + 1}`).value = s; });
    if (states.length > 0) {
      listsSheet.workbook.definedNames.add(`Lists!$${stateCol}$1:$${stateCol}$${states.length}`, `State_${countryIdx + 1}`);
    }
    col += 1;
    states.forEach((state) => {
      regionLookupRows.push({ key: `${country}|${state}`, index: regionLookupRows.length + 1, country, state });
    });
  });

  const regionLookupCol1 = listsSheet.getColumn(col).letter;
  const regionLookupCol2 = listsSheet.getColumn(col + 1).letter;
  regionLookupRows.forEach((r, i) => {
    listsSheet.getCell(`${regionLookupCol1}${i + 1}`).value = r.key;
    listsSheet.getCell(`${regionLookupCol2}${i + 1}`).value = r.index;
  });
  if (regionLookupRows.length > 0) {
    listsSheet.workbook.definedNames.add(`Lists!$${regionLookupCol1}$1:$${regionLookupCol2}$${regionLookupRows.length}`, 'Region_index_lookup');
  }
  col += 2;

  regionLookupRows.forEach((r) => {
    const lgas = [...new Set(regionsData.filter((row) => row.country === r.country && row.level === 'lga' && row.parent_name === r.state).map((row) => row.name))];
    const lgaCol = listsSheet.getColumn(col).letter;
    lgas.forEach((l, i) => { listsSheet.getCell(`${lgaCol}${i + 1}`).value = l; });
    if (lgas.length > 0) {
      listsSheet.workbook.definedNames.add(`Lists!$${lgaCol}$1:$${lgaCol}$${lgas.length}`, `LGA_${r.index}`);
    }
    col += 1;
  });

  return col;
}

// Generates and downloads an .xlsx template for the given template key.
// Real dropdowns (Excel data validation), not just an instructions column
// describing the allowed values — a column with a fixed or live-fetched
// allowed list gets an actual in-cell dropdown, so a typo becomes
// impossible instead of just discouraged. Required columns get a visibly
// different header color from optional ones, matching exactly what's
// required/optional in the matching single-upload form (checked directly
// against each form's own real validation logic, not assumed) --
// switched from xlsx.js to exceljs specifically because xlsx.js's free
// tier cannot write real data validation or header styling at all,
// confirmed directly by inspecting a generated file's raw XML before
// making this change.
export async function downloadTemplate(templateKey, filename, supplyChainId, filters = {}) {
  const template = BULK_UPLOAD_TEMPLATES[templateKey];
  if (!template) throw new Error(`Unknown bulk upload template: ${templateKey}`);

  const dynamicOptions = supplyChainId ? await fetchDynamicOptions(supplyChainId, template.columns, filters) : {};

  const workbook = new ExcelJS.Workbook();
  // Real, merged group-header row above the column names -- opt-in,
  // based on whether this template's columns declare a group at all, so
  // templates with no groups (Contracts, Receive Stock) render exactly
  // as before: a single header row. Only Beekeepers currently uses this.
  const hasGroups = template.columns.some((c) => c.group);
  const headerRowIndex = hasGroups ? 2 : 1;
  const firstDataRow = headerRowIndex + 1;
  const lastDataRow = firstDataRow + 498; // 499 usable data rows, same as before this change

  const sheet = workbook.addWorksheet(template.label, { views: [{ state: 'frozen', ySplit: headerRowIndex }] });
  // Hidden sheet holding the real option lists, referenced by range
  // (e.g. Lists!$A$2:$A$11) rather than an inline comma-separated
  // formula -- Excel's inline list formula is capped at 255 characters
  // total, which a real actor_code list (potentially many actors, each
  // a "code - name" string) would likely exceed and silently break.
  // A range reference has no such limit.
  const listsSheet = workbook.addWorksheet('Lists', { state: 'veryHidden' });
  let listsSheetNextCol = 1;
  if (dynamicOptions.regions) {
    listsSheetNextCol = buildRegionCascade(listsSheet, dynamicOptions.regions, listsSheetNextCol);
  }

  sheet.columns = template.columns.map((c) => ({
    key: c.key,
    width: Math.max(18, Math.min(38, c.label.length + 4)),
  }));

  if (hasGroups) {
    const groupRow = sheet.getRow(1);
    groupRow.height = 24;
    let runStart = 0;
    for (let i = 1; i <= template.columns.length; i += 1) {
      const changed = i === template.columns.length || template.columns[i].group !== template.columns[runStart].group;
      if (changed) {
        const groupName = template.columns[runStart].group || '';
        if (groupName) {
          if (i - 1 > runStart) sheet.mergeCells(1, runStart + 1, 1, i);
          const cell = groupRow.getCell(runStart + 1);
          cell.value = groupName;
          cell.font = { bold: true, color: { argb: WHITE }, size: 11 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        runStart = i;
      }
    }
  }

  const headerRow = sheet.getRow(headerRowIndex);
  headerRow.height = 32;
  template.columns.forEach((c, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = c.label;
    cell.font = { bold: true, color: { argb: c.required ? NAVY : WHITE }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: c.required ? AMBER_FILL : BLUE } };
    cell.alignment = { wrapText: true, vertical: 'middle' };
  });

  const exampleRow = {};
  const firstRegionRow = dynamicOptions.regions?.[0];
  const exampleCountry = firstRegionRow?.country;
  const exampleState = exampleCountry ? dynamicOptions.regions.find((r) => r.country === exampleCountry && r.level === 'state')?.name : null;
  const exampleLga = exampleState ? dynamicOptions.regions.find((r) => r.country === exampleCountry && r.level === 'lga' && r.parent_name === exampleState)?.name : null;
  template.columns.forEach((c) => {
    const dynamicList = dynamicOptions[c.key] || (c.softDropdown && dynamicOptions[c.softDropdown]);
    if (c.cascadeLevel === 'country') exampleRow[c.key] = exampleCountry || '';
    else if (c.cascadeLevel === 'state') exampleRow[c.key] = exampleState || '';
    else if (c.cascadeLevel === 'lga') exampleRow[c.key] = exampleLga || '';
    else if (dynamicList && dynamicList.length > 0) exampleRow[c.key] = dynamicList[0];
    else if (c.type === 'array' && c.allowed) exampleRow[c.key] = c.allowed[0];
    else if (c.type === 'boolean') exampleRow[c.key] = 'No';
    else if (c.atLeastOneOf) exampleRow[c.key] = 'No';
    else if (c.allowed) exampleRow[c.key] = c.allowed[0];
    else if (c.type === 'number') exampleRow[c.key] = 0;
    else if (c.key === 'transaction_date' || c.key === 'signature_date') exampleRow[c.key] = '15-01-2026';
    else if (c.computed) exampleRow[c.key] = null; // filled with a real formula below, not a static value
    else exampleRow[c.key] = '';
  });
  // At least one atLeastOneOf group member needs a real "Yes" example, or
  // the example row itself would fail the very validation rule it's
  // meant to demonstrate.
  const atLeastOneOfGroups = [...new Set(template.columns.filter((c) => c.atLeastOneOf).map((c) => c.atLeastOneOf))];
  atLeastOneOfGroups.forEach((group) => {
    const firstInGroup = template.columns.find((c) => c.atLeastOneOf === group);
    if (firstInGroup) exampleRow[firstInGroup.key] = 'Yes';
  });
  const addedExampleRow = sheet.getRow(firstDataRow);
  template.columns.forEach((c, idx) => { addedExampleRow.getCell(idx + 1).value = exampleRow[c.key]; });
  addedExampleRow.font = { italic: true, color: { argb: 'FF5A6F9A' } };
  addedExampleRow.commit();

  // Real Excel formula cells for every computed column, across the full
  // usable data range -- a genuine live formula per row
  // (e.g. =E10*G10), not a static number that goes stale the moment
  // Quantity or Unit price changes. Styled distinctly (grey fill) to
  // signal it's calculated, not something to type into directly.
  const COMPUTED_FILL = 'FFE8ECF3';
  template.columns.forEach((c, idx) => {
    if (!c.computed || !c.formula?.multiply) return;
    const colLetter = sheet.getColumn(idx + 1).letter;
    const [factorAKey, factorBKey] = c.formula.multiply;
    const colA = sheet.getColumn(template.columns.findIndex((col) => col.key === factorAKey) + 1).letter;
    const colB = sheet.getColumn(template.columns.findIndex((col) => col.key === factorBKey) + 1).letter;
    for (let row = firstDataRow; row <= lastDataRow; row++) {
      const cell = sheet.getCell(`${colLetter}${row}`);
      cell.value = { formula: `IF(OR(${colA}${row}="",${colB}${row}=""),"",${colA}${row}*${colB}${row})` };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COMPUTED_FILL } };
    }
  });

  // Real Excel data validation dropdowns, applied to a large real range
  // so they keep working as someone fills in more rows, not just the
  // one example row.
  template.columns.forEach((c, idx) => {
    if (c.computed) return; // formula cells above, no dropdown needed
    const colLetter = sheet.getColumn(idx + 1).letter;

    if (c.cascadeLevel === 'country') {
      const validation = { type: 'list', allowBlank: !c.required, formulae: ['Countries_list'], showErrorMessage: true, errorTitle: 'Invalid entry', error: `Please choose a real Country from the dropdown.` };
      for (let row = firstDataRow; row <= lastDataRow; row++) sheet.getCell(`${colLetter}${row}`).dataValidation = validation;
      return;
    }
    if (c.cascadeLevel === 'state') {
      const countryColLetter = sheet.getColumn(template.columns.findIndex((col) => col.cascadeLevel === 'country') + 1).letter;
      // The INDIRECT formula references the same row's Country cell, so
      // each row genuinely needs its own validation object (row-relative
      // reference), unlike the fixed-list case above where one shared
      // object safely covers every row.
      for (let row = firstDataRow; row <= lastDataRow; row++) {
        sheet.getCell(`${colLetter}${row}`).dataValidation = {
          type: 'list', allowBlank: !c.required,
          formulae: [`INDIRECT("State_"&VLOOKUP($${countryColLetter}${row},Country_index_lookup,2,FALSE))`],
          showErrorMessage: true, errorTitle: 'Invalid entry', error: 'Please choose a Region for the selected Country.',
        };
      }
      return;
    }
    if (c.cascadeLevel === 'lga') {
      const countryColLetter = sheet.getColumn(template.columns.findIndex((col) => col.cascadeLevel === 'country') + 1).letter;
      const stateColLetter = sheet.getColumn(template.columns.findIndex((col) => col.cascadeLevel === 'state') + 1).letter;
      for (let row = firstDataRow; row <= lastDataRow; row++) {
        sheet.getCell(`${colLetter}${row}`).dataValidation = {
          type: 'list', allowBlank: !c.required,
          formulae: [`INDIRECT("LGA_"&VLOOKUP($${countryColLetter}${row}&"|"&$${stateColLetter}${row},Region_index_lookup,2,FALSE))`],
          showErrorMessage: true, errorTitle: 'Invalid entry', error: 'Please choose an LGA for the selected Region.',
        };
      }
      return;
    }

    const dynamicList = dynamicOptions[c.key] || (c.softDropdown && dynamicOptions[c.softDropdown]);
    const list = dynamicList && dynamicList.length > 0 ? dynamicList : c.allowed;
    if (!list || list.length === 0) return;

    // Write the real option list to the hidden Lists sheet, one column
    // per dropdown, and build a real range reference to it.
    const listColLetter = listsSheet.getColumn(listsSheetNextCol).letter;
    list.forEach((val, i) => { listsSheet.getCell(`${listColLetter}${i + 1}`).value = val; });
    const rangeRef = `Lists!$${listColLetter}$1:$${listColLetter}$${list.length}`;
    listsSheetNextCol += 1;

    const validation = {
      type: 'list',
      allowBlank: !c.required,
      formulae: [rangeRef],
      // Soft dropdowns (e.g. a producer-organisation column, if a future
      // template uses one) show a non-blocking warning instead of
      // rejecting the entry outright.
      errorStyle: c.softDropdown ? 'warning' : 'stop',
      showErrorMessage: true,
      errorTitle: 'Invalid entry',
      error: c.softDropdown
        ? `This doesn't match a known ${c.label} yet -- that's OK if it's a real, new one, just double-check the spelling.`
        : `Please choose one of the values from the dropdown for "${c.label}".`,
    };
    for (let row = firstDataRow; row <= lastDataRow; row++) {
      sheet.getCell(`${colLetter}${row}`).dataValidation = validation;
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `${template.label.toLowerCase()}-template.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function parseFile(file, template) {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const workbook = XLSX.read(e.target.result, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          // Templates with a group-header row (currently just Beekeepers)
          // have the real column names on row 2, not row 1 -- range: 1
          // skips row 1 entirely so sheet_to_json uses row 2 as headers,
          // matching exactly what downloadTemplate generated. Without
          // this, the group labels themselves (repeated across several
          // columns, e.g. "Biographic data" for both Full name and
          // Gender) would be used as the column keys instead, and since
          // object keys must be unique, every column sharing a group
          // would silently collide and overwrite the last one.
          const hasGroups = template?.columns?.some((c) => c.group);
          const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', range: hasGroups ? 1 : 0 });
          resolve(rows);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsBinaryString(file);
    } else {
      reject(new Error('Unsupported file type. Please upload an .xlsx file.'));
    }
  });
}

// Resolves the human-readable codes people actually type into a CSV/Excel
// sheet (village name, actor/beekeeper traceability code) into the real
// UUID foreign keys the tables need. Without this, bulk rows were being
// inserted with columns like village_name/actor_code/beekeeper_code, which
// don't exist on beekeepers/transactions at all — Supabase rejects the
// whole batch before anything is written.
async function fetchLookups(supplyChainId, templateKey) {
  const lookups = { villagesByName: {}, actorsByCode: {}, beekeepersByCode: {} };

  if (templateKey === 'beekeepers') {
    const { data, error } = await supabase.from('villages').select('id, name, country, state_region, lga_municipality').eq('supply_chain_id', supplyChainId);
    if (error) throw error;
    data.forEach((v) => {
      const key = [v.name, v.country, v.state_region, v.lga_municipality].map((s) => (s || '').trim().toLowerCase()).join('|');
      lookups.villagesByName[key] = v.id;
    });
  }

  if (templateKey === 'transactions' || templateKey === 'contracts') {
    const [actorsRes, beekeepersRes] = await Promise.all([
      supabase.from('actors').select('id, traceability_code').eq('supply_chain_id', supplyChainId),
      supabase.from('beekeepers').select('id, traceability_code').eq('supply_chain_id', supplyChainId),
    ]);
    if (actorsRes.error) throw actorsRes.error;
    if (beekeepersRes.error) throw beekeepersRes.error;
    actorsRes.data.forEach((a) => { if (a.traceability_code) lookups.actorsByCode[a.traceability_code.trim().toLowerCase()] = a.id; });
    beekeepersRes.data.forEach((b) => { if (b.traceability_code) lookups.beekeepersByCode[b.traceability_code.trim().toLowerCase()] = b.id; });
  }

  return lookups;
}

// Real gap found and fixed: header matching was exact and case-sensitive
// (row[col.label] ?? row[col.key]), so a file with "Full Name" instead of
// the template's own "Full name" would silently fail to match at all --
// the field would be treated as empty, showing a confusing "required"
// error for data that was genuinely there, just under a slightly
// different-cased header. Normalizes case and collapses whitespace before
// comparing, so small real-world formatting differences (a report
// exported with Title Case headers, a header with extra trailing spaces)
// don't silently break an otherwise-valid upload.
function normalizeHeader(s) {
  return String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function buildNormalizedRowLookup(row) {
  const map = new Map();
  Object.keys(row).forEach((k) => map.set(normalizeHeader(k), row[k]));
  return map;
}

function getRowValue(rowLookup, col) {
  return rowLookup.get(normalizeHeader(col.label)) ?? rowLookup.get(normalizeHeader(col.key)) ?? '';
}

// Real gap found and fixed: nothing ever told a person their file might
// be the wrong one entirely (e.g. a downloaded report used by mistake
// instead of the real upload template) -- columns the template doesn't
// recognize were just silently ignored, with zero indication anything
// was wrong.
function detectUnrecognizedColumns(rawRows, template) {
  if (rawRows.length === 0) return [];
  const knownNormalized = new Set(
    template.columns.flatMap((c) => [normalizeHeader(c.label), normalizeHeader(c.key)])
  );
  const realHeaders = Object.keys(rawRows[0]);
  return realHeaders.filter((h) => !knownNormalized.has(normalizeHeader(h)));
}

function validateRows(rows, template, lookups, isHistorical) {
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
        // Real DD-MM-YYYY parsing, not a loose pass-through -- the
        // database needs a real ISO date, and the heading now explicitly
        // promises DD-MM-YYYY, so this has to actually enforce that
        // format and reject anything that doesn't genuinely parse as a
        // real calendar date (e.g. 31-02-2026), not silently accept an
        // ambiguous or wrong one.
        const match = String(value).match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
        if (!match) {
          errors.push(`${col.label} must be in DD-MM-YYYY format`);
        } else {
          const day = Number(match[1]);
          const month = Number(match[2]);
          const year = Number(match[3]);
          const parsed = new Date(Date.UTC(year, month - 1, day));
          const isRealDate = parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
          if (!isRealDate) {
            errors.push(`${col.label}: "${value}" is not a real date`);
          } else {
            value = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          }
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

      const numericValue = col.type === 'number' && value !== '' ? Number(value) : value;

      // Resolve text codes/names to the real FK columns instead of storing
      // them verbatim under a column name the table doesn't have.
      if (col.key === 'village_name') {
        if (value) {
          const key = [value, cleaned.country, cleaned.state_region, cleaned.lga_municipality].map((s) => String(s || '').toLowerCase()).join('|');
          const id = lookups.villagesByName[key];
          if (!id) errors.push(`Village "${value}" not found in ${cleaned.lga_municipality || ''}, ${cleaned.state_region || ''}, ${cleaned.country || ''} — check the spelling and address match exactly, or this village hasn't been added to the app yet`);
          cleaned.village_id = id || null;
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
    }

    return { rowNumber: index + 2, data: cleaned, errors };
  });
}

export function useBulkUpload(templateKey) {
  const { supplyChainId } = useAuth();
  const queryClient = useQueryClient();
  const template = BULK_UPLOAD_TEMPLATES[templateKey];
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [result, setResult] = useState(null);
  const [isHistorical, setIsHistorical] = useState(false);
  const [unrecognizedColumns, setUnrecognizedColumns] = useState([]);
  // Same real gap and fix as the transaction forms: disabled={uploading}
  // alone has a known race (React's re-render isn't synchronous), and
  // this hook is shared by 3 different callers, so fixing it once here
  // protects all of them consistently.
  const submittingRef = useRef(false);

  const loadFile = useCallback(async (file) => {
    setFileName(file.name);
    setResult(null);
    setParseError(null);
    setUnrecognizedColumns([]);
    setParsing(true);
    try {
      const [rawRows, lookups] = await Promise.all([
        parseFile(file, template),
        fetchLookups(supplyChainId, templateKey),
      ]);
      setUnrecognizedColumns(detectUnrecognizedColumns(rawRows, template));
      const validated = validateRows(rawRows, template, lookups, isHistorical);
      setRows(validated);

      // Real gap found via user report ("no trace of the transaction
      // bulk upload in the list"): when every row fails validation, the
      // Import button is disabled (validCount === 0), so submit() --
      // and the bulk_uploads logging inside it -- never runs. A fully
      // failed upload attempt (the exact case someone most needs a
      // record of) simply vanished the moment they closed the dialog,
      // with nothing in the history page to show it ever happened.
      // Logged here instead, the moment verification itself confirms
      // zero valid rows, rather than waiting on a submit that can now
      // never come. Contracts excluded to match the existing rule just
      // below in submit() (upload_type CHECK constraint doesn't include
      // 'Contracts').
      const validCountNow = validated.filter((r) => r.errors.length === 0).length;
      if (validCountNow === 0 && validated.length > 0 && template.table !== 'contracts' && supplyChainId) {
        const failureMessages = validated
          .map((r, idx) => (r.errors.length > 0 ? `Row ${idx + 1}: ${r.errors[0]}` : null))
          .filter(Boolean)
          .slice(0, 5);
        try {
          await supabase.from('bulk_uploads').insert({
            supply_chain_id: supplyChainId,
            upload_type: template.uploadType,
            file_name: file.name,
            status: 'Failed',
            progress: 100,
            error_detail: failureMessages.join(' | '),
          });
          queryClient.invalidateQueries({ queryKey: ['bulk_uploads'] });
        } catch (logErr) {
          console.error('Failed to log fully-failed bulk upload attempt:', logErr);
        }
      }
    } catch (err) {
      // parseFile rejects (e.g. non-.xlsx file) with a real Error. Store it
      // for callers that just read `parseError` state (ReceiveStockForm's
      // fire-and-forget onChange), but also re-throw so callers that
      // already `await` + catch this themselves (AddBeekeeperDialog) keep
      // their existing, more specific error handling.
      setRows([]);
      setParseError(err.message);
      throw err;
    } finally {
      setParsing(false);
    }
  }, [template, templateKey, supplyChainId, isHistorical]);

  const validCount = rows.filter((r) => r.errors.length === 0).length;
  const errorCount = rows.length - validCount;

  const submit = useCallback(async (options = {}) => {
    if (submittingRef.current) return { inserted: 0, failed: 0 };
    submittingRef.current = true;
    setUploading(true);
    const validRows = rows.filter((r) => r.errors.length === 0).map((r) => ({
      ...r.data,
      supply_chain_id: supplyChainId,
      // Same reasoning as the historical RPC branch above: receiveStock
      // rows no longer carry their own standard/unit, so they're stamped
      // on here from the batch-level choice instead of the (now
      // nonexistent) per-row column.
      ...(templateKey === 'receiveStock' ? { standard: options.standard, unit: 'Kg' } : {}),
    }));
    const validationFailedCount = rows.length - validRows.length;
    // Real gap found via tracing why Failed uploads had a blank
    // error_detail even after BUG-21 wired up DB-error capture: rows
    // that fail our own client-side validation (wrong/missing fields,
    // never even reach an insert) carry their own `errors` per row
    // (validateRows above), but that was only ever used to compute a
    // count here, never surfaced as text. An upload that fails purely
    // on validation -- arguably the most common real failure mode --
    // ended up with a totalFailed count but no reason a person could
    // read. Capped at 5 for the same reason the DB-error path caps at
    // 5 below: error_detail is a short summary, not a full log.
    const validationErrorMessages = rows
      .map((r, idx) => (r.errors.length > 0 ? `Row ${idx + 1}: ${r.errors[0]}` : null))
      .filter(Boolean)
      .slice(0, 5);

    // Historical transactions need `app.bulk_import_mode` set and (for
    // Send rows) auto_consume_stock_for_bulk_import() called in the SAME
    // db transaction as the insert -- neither is possible through a plain
    // client-side .insert(), so this path calls the bulk_import_transaction
    // RPC once per row instead of the generic batched insert below.
    if (template.table === 'transactions' && isHistorical) {
      let inserted = 0;
      let failed = 0;
      let shortfallCount = 0;
      const errors = [...validationErrorMessages];
      for (const row of validRows) {
        const { data, error } = await supabase.rpc('bulk_import_transaction', {
          p_direction: row.direction,
          // receiveStock no longer carries a standard column (see the
          // template definition above) -- the batch-level choice from
          // ReceiveStockForm's top selector is the only source for it
          // now. The generic transactions template still has its own
          // per-row standard, used as-is.
          p_standard: templateKey === 'receiveStock' ? options.standard : row.standard,
          p_actor_id: row.actor_id || null,
          p_beekeeper_id: row.beekeeper_id || null,
          p_product: row.product,
          p_quantity: row.quantity,
          p_unit: templateKey === 'receiveStock' ? 'Kg' : (row.unit || 'Kg'),
          p_price: row.price,
          // The Transactions template has no currency column at all (it's
          // a supply-chain-wide currency choice made once on the form, not
          // per-row) -- `row.currency` is always undefined here, which
          // supabase-js strips entirely, breaking the RPC's arg match.
          // Callers must pass the form's selected currency explicitly.
          p_currency: options.currency,
          p_transaction_date: row.transaction_date,
        });
        if (error) {
          failed += 1;
          errors.push(error.message);
        } else {
          inserted += 1;
          if (data?.stock_shortfall > 0) shortfallCount += 1;
        }
      }
      const totalFailed = failed + validationFailedCount;
      try {
        await supabase.from('bulk_uploads').insert({
          supply_chain_id: supplyChainId,
          upload_type: template.uploadType,
          // Real bug found via tracing the actual call chain (M7):
          // this always used the closure-captured `fileName` state.
          // Every real caller invokes submit() immediately after
          // await loadFile(file) inside the same handler -- loadFile
          // does correctly call setFileName(file.name) internally, but
          // the already-running caller's own closure still references
          // whatever `submit` function existed BEFORE that state
          // update, not the fresh one React creates afterward. A
          // classic stale-closure gap, not a timing coincidence.
          // options.fileName is a real, explicit value the caller
          // already has in hand (the actual File object's own .name),
          // sidestepping the closure risk entirely rather than trying
          // to out-time it.
          file_name: options.fileName ?? fileName,
          status: inserted === 0 ? 'Failed' : 'Completed',
          progress: 100,
          // Real bug found via independent audit (BUG-21): `errors` was
          // already being collected above, just never saved anywhere.
          error_detail: errors.length > 0 ? errors.slice(0, 5).join(' | ') : null,
        });
      } catch (logErr) {
        console.error('Failed to log bulk upload history:', logErr);
      }
      if (inserted > 0) {
        queryClient.invalidateQueries({ queryKey: [template.table] });
        queryClient.invalidateQueries({ queryKey: ['bulk_uploads'] });
        queryClient.invalidateQueries({ queryKey: ['stocks'] });
      }
      setUploading(false);
      const res = { inserted, updated: 0, failed: totalFailed, errors, shortfallCount };
      setResult(res);
      return res;
    }

    let inserted = 0;
    let updated = 0;
    let failed = 0;
    const errors = [...validationErrorMessages];

    // For beekeepers specifically: re-uploading the same file (accidentally,
    // or "just to be safe") previously created genuine duplicate records --
    // the same class of real, documented problem found on the platform this
    // rebuild is measured against (real duplicate beekeepers, risk of
    // double-counting or double-payment). There's no traceability_code
    // column in this template (it's server-generated), so a database-level
    // upsert isn't directly possible -- instead, match existing beekeepers
    // by (full_name, village_id) within the same supply chain before
    // inserting, and update the existing row instead of creating a new one.
    // This deliberately does NOT attempt fuzzy/similarity matching across
    // near-duplicate spellings (e.g. "N Tcha Matie" vs "NTctha Matie") --
    // that's a separate, larger feature (a real merge-screen UI), not a
    // quick fix bolted onto this one.
    let existingByKey = new Map();
    if (template.table === 'beekeepers' && validRows.length > 0) {
      const { data: existing, error: lookupError } = await supabase
        .from('beekeepers')
        .select('id, full_name, village_id')
        .eq('supply_chain_id', supplyChainId);
      if (!lookupError && existing) {
        existingByKey = new Map(
          existing.map((b) => [`${b.full_name?.trim().toLowerCase()}|${b.village_id}`, b.id])
        );
      }
    }

    const toInsert = [];
    const toUpdate = [];
    if (existingByKey.size > 0) {
      for (const row of validRows) {
        const key = `${row.full_name?.trim().toLowerCase()}|${row.village_id}`;
        const existingId = existingByKey.get(key);
        if (existingId) {
          toUpdate.push({ id: existingId, ...row });
        } else {
          toInsert.push(row);
        }
      }
    } else {
      toInsert.push(...validRows);
    }

    // Insert in batches of 100 to avoid oversized payloads
    const BATCH_SIZE = 100;
    for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
      const batch = toInsert.slice(i, i + BATCH_SIZE);
      const { error, count } = await supabase.from(template.table).insert(batch).select('*', { count: 'exact' });
      if (error) {
        failed += batch.length;
        errors.push(error.message);
      } else {
        inserted += count ?? batch.length;
      }
    }

    // Updates go one at a time (each has a different id, so they can't be
    // batched into a single statement the way same-shape inserts can).
    for (const row of toUpdate) {
      const { id, ...patch } = row;
      const { error } = await supabase.from(template.table).update(patch).eq('id', id);
      if (error) {
        failed += 1;
        errors.push(error.message);
      } else {
        updated += 1;
      }
    }

    const totalFailed = failed + validationFailedCount;

    // Log this upload to bulk_uploads so the Bulk Uploads history page
    // (Connections/Transactions tabs) actually reflects real activity,
    // instead of always showing empty. Contracts imports are skipped here
    // on purpose: `bulk_uploads.upload_type` has a CHECK constraint that
    // doesn't include 'Contracts', and the product owner chose not to
    // widen it — the contracts themselves still import correctly, they
    // just won't show up on the Bulk Uploads history page.
    if (template.table !== 'contracts') {
      try {
        await supabase.from('bulk_uploads').insert({
          supply_chain_id: supplyChainId,
          upload_type: template.uploadType,
          // Same real fix as the transactions path above (M7): prefer
          // the explicitly-passed value over the closure-captured
          // hook state.
          file_name: options.fileName ?? fileName,
          status: (inserted === 0 && updated === 0) ? 'Failed' : 'Completed',
          progress: 100,
          // Same fix as the transactions path above (BUG-21): `errors`
          // was already being collected throughout this function, just
          // never saved anywhere.
          error_detail: errors.length > 0 ? errors.slice(0, 5).join(' | ') : null,
          ...(template.uploadType === 'Connections'
            ? { new_beekeepers: inserted, updated_beekeepers: updated }
            : {}),
        });
      } catch (logErr) {
        // Don't let a logging failure block the person from seeing their
        // actual import result — just note it happened.
        console.error('Failed to log bulk upload history:', logErr);
      }
    }

    if (inserted > 0 || updated > 0) {
      queryClient.invalidateQueries({ queryKey: [template.table] });
      queryClient.invalidateQueries({ queryKey: ['bulk_uploads'] });
    }

    setUploading(false);
    setResult({ inserted, updated, failed: totalFailed, errors });
    return { inserted, updated, failed: totalFailed, errors };
  }, [rows, supplyChainId, template, fileName, queryClient, isHistorical]);

  const reset = useCallback(() => {
    setRows([]);
    setFileName('');
    setResult(null);
    setParseError(null);
    setParsing(false);
    setUnrecognizedColumns([]);
  }, []);

  return {
    template,
    rows,
    fileName,
    validCount,
    errorCount,
    uploading,
    parsing,
    parseError,
    result,
    isHistorical,
    setIsHistorical,
    unrecognizedColumns,
    loadFile,
    submit,
    reset,
  };
}
