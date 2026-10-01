import ExcelJS from 'exceljs';
import { supabase } from '@/lib/supabaseClient';
import { BULK_UPLOAD_TEMPLATES } from '../domain/templates';

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

  // Beekeeper list should export every existing beekeeper pre-filled, so
  // the same file can be used to both correct old data (edit a row, keep
  // its traceability code) and onboard new beekeepers (add rows below,
  // leave the code blank) in one upload -- per explicit request. Fetched
  // as two plain queries rather than a relational embed, so the village
  // join is explicit and predictable rather than depending on exactly
  // how Supabase infers the FK relationship name.
  let existingBeekeeperRows = [];
  if (templateKey === 'beekeepers' && supplyChainId) {
    const { data: beekeepers } = await supabase
      .from('beekeepers')
      .select('full_name, traceability_code, gender, year_of_birth, national_id, internal_code, linked_producer_organisation, contact_phone, village_id, standards, commitment, charter_signed, hives_traditional_single, hives_traditional_double, hives_modern, hives_other, hive_cashew, hive_mango, hive_shea, hive_forest, hive_other_forage')
      .eq('supply_chain_id', supplyChainId)
      .order('created_at', { ascending: true });
    if (beekeepers?.length) {
      const villageIds = [...new Set(beekeepers.map((b) => b.village_id).filter(Boolean))];
      const { data: villageRows } = villageIds.length
        ? await supabase.from('villages').select('id, name, country, state_region, lga_municipality').in('id', villageIds)
        : { data: [] };
      const villagesById = new Map((villageRows || []).map((v) => [v.id, v]));
      const yn = (b) => (b ? 'Yes' : 'No');
      existingBeekeeperRows = beekeepers.map((b) => {
        const v = b.village_id ? villagesById.get(b.village_id) : null;
        const standards = b.standards || [];
        const commitment = b.commitment || [];
        return {
          full_name: b.full_name || '',
          traceability_code: b.traceability_code || '',
          gender: b.gender || '',
          year_of_birth: b.year_of_birth ?? '',
          national_id: b.national_id || '',
          internal_code: b.internal_code || '',
          linked_producer_organisation: b.linked_producer_organisation || '',
          contact_phone: b.contact_phone || '',
          country: v?.country || '',
          state_region: v?.state_region || '',
          lga_municipality: v?.lga_municipality || '',
          village_name: v?.name || '',
          standard_sustainable: yn(standards.includes('Sustainable')),
          standard_organic: yn(standards.includes('Organic')),
          standard_conventional: yn(standards.includes('Conventional')),
          charter_signed: yn(b.charter_signed),
          commitment_crude_honey: yn(commitment.includes('Crude honey')),
          commitment_honey: yn(commitment.includes('Honey')),
          commitment_beeswax: yn(commitment.includes('Beeswax')),
          hives_traditional_single: b.hives_traditional_single ?? '',
          hives_traditional_double: b.hives_traditional_double ?? '',
          hives_modern: b.hives_modern ?? '',
          hives_other: b.hives_other ?? '',
          hive_cashew: b.hive_cashew ?? '',
          hive_mango: b.hive_mango ?? '',
          hive_shea: b.hive_shea ?? '',
          hive_forest: b.hive_forest ?? '',
          hive_other_forage: b.hive_other_forage ?? '',
        };
      });
    }
  }

  const workbook = new ExcelJS.Workbook();
  // Real, merged group-header row above the column names -- opt-in,
  // based on whether this template's columns declare a group at all, so
  // templates with no groups (Contracts, Receive Stock) render exactly
  // as before: a single header row. Only Beekeepers currently uses this.
  const hasGroups = template.columns.some((c) => c.group);
  const headerRowIndex = hasGroups ? 2 : 1;
  const firstDataRow = headerRowIndex + 1;
  const lastDataRow = firstDataRow + Math.max(499, existingBeekeeperRows.length + 500) - 1; // 500 blank rows for new entries, after however many existing beekeepers are pre-filled

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

  // Watermark/example data removed from all bulk upload templates, per
  // explicit request. Previously wrote a full example row of plausible
  // values directly into the first real data row (firstDataRow) --
  // genuinely risky for templates like Transactions/Contracts where
  // every field has a valid-looking example value: a user who didn't
  // notice and delete it (easy to miss -- italic styling was the only
  // visual cue) could have it uploaded as a real, fake record. The
  // template now starts genuinely blank. firstDataRow/lastDataRow are
  // unchanged, so the dropdown validation and computed-formula ranges
  // below still apply correctly to every row -- only the example
  // VALUES are gone, not the working template structure underneath.

  // Beekeeper list export: write every existing beekeeper as a real,
  // pre-filled row (built above), so editing a cell and re-uploading
  // updates that exact beekeeper -- rows below these, left blank, are
  // for genuinely new beekeepers. Not styled distinctly from a blank
  // row: this is real, current data, not a placeholder to be wary of.
  existingBeekeeperRows.forEach((rowData, i) => {
    const sheetRow = sheet.getRow(firstDataRow + i);
    template.columns.forEach((c, idx) => { sheetRow.getCell(idx + 1).value = rowData[c.key] ?? ''; });
    sheetRow.commit();
  });

  // Date columns are pre-formatted as Text across the whole usable
  // range. Left General-formatted, Excel silently converts a typed
  // "15/01/2026" into a real date value (a serial number, 46037) on
  // day-first-locale machines -- confirmed empirically to read back as
  // a bare number, which a text-based DD/MM/YYYY check can never
  // match, so someone typing exactly the right thing still got told the
  // format was wrong. Text format makes Excel keep exactly what's typed.
  // (Pasting from another sheet can still override the cell's format,
  // which is why the parser also accepts a raw date serial -- see
  // lib/dateParsing.js. The two are complementary, not redundant.)
  template.columns.forEach((c, idx) => {
    if (c.type !== 'date') return;
    const colLetter = sheet.getColumn(idx + 1).letter;
    for (let row = firstDataRow; row <= lastDataRow; row++) {
      sheet.getCell(`${colLetter}${row}`).numFmt = '@';
    }
  });

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
