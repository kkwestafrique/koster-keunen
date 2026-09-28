// Report layouts matching the old MIS exports exactly (same sheet names,
// headers, column order and widths), per explicit request. Headers and
// widths below were extracted programmatically from the old MIS files
// (e.g. Beekeepers_List_OLD_LEVI_MULTIBIZ_SERVICES_LTD.xlsx), not retyped.
//
// Summary-report rules were each confirmed by rebuilding the old files'
// totals from the old row-level exports before being written here:
// - Potential: beekeepers registered in or before the report year with
//   that standard (12/12 rows matched on men/women).
// - Achieved: beekeepers who delivered in the report year, grouped by
//   their own registered standards (10/12 rows exact; the other 2
//   differ only on charter/hive status that has since changed).
// - Youth: aged 35 or under in the report year (12/12).
// - Potential "Number of Producer Organization": distinct producer
//   organisations (9/9). Achieved "...INVOLVED": involved beekeepers
//   who belong to a producer organisation (12/12).
// - Villages: counted as distinct villages. The old MIS counted by name
//   only (merging same-named villages in different LGAs); per explicit
//   decision, the new reports count each village separately.
// Known limit: the app stores only each beekeeper's CURRENT hive counts,
// so hive totals for past years use today's figures.

import ExcelJS from 'exceljs';

export const REPORT_TEMPLATES = {
  "beekeeperList": {
    "sheetName": "Beekeepers List",
    "fileBase": "Beekeepers_List",
    "columns": [
      {
        "header": "YEAR",
        "width": 6
      },
      {
        "header": "TRACEABILITY CODE",
        "width": 25
      },
      {
        "header": "INTERNAL CODE",
        "width": 20
      },
      {
        "header": "BEEKEEPER NAME",
        "width": 31
      },
      {
        "header": "GENDER (M/F/O)",
        "width": 16
      },
      {
        "header": "YEAR OF BIRTH",
        "width": 15
      },
      {
        "header": "NATIONAL ID NUMBER",
        "width": 20
      },
      {
        "header": "PRODUCER ORGANIZATION",
        "width": 30
      },
      {
        "header": "PHONE NUMBER",
        "width": 17
      },
      {
        "header": "VILLAGE",
        "width": 16
      },
      {
        "header": "LGA / MUNICIPALITY / PROVINCE",
        "width": 31
      },
      {
        "header": "STATE / REGION / DEPARTEMENT",
        "width": 30
      },
      {
        "header": "COUNTRY",
        "width": 9
      },
      {
        "header": "TRADITIONAL SINGLE ENTRY",
        "width": 26
      },
      {
        "header": "TRADITIONAL DOUBLE ENTRY",
        "width": 26
      },
      {
        "header": "MODERN",
        "width": 8
      },
      {
        "header": "OTHER HIVE",
        "width": 12
      },
      {
        "header": "CASHEW",
        "width": 8
      },
      {
        "header": "MANGO",
        "width": 7
      },
      {
        "header": "SHEA",
        "width": 6
      },
      {
        "header": "FOREST",
        "width": 8
      },
      {
        "header": "OTHER FORAGE",
        "width": 14
      },
      {
        "header": "DELIVERED BEESWAX",
        "width": 19
      },
      {
        "header": "DELIVERED HONEY",
        "width": 17
      },
      {
        "header": "DELIVERED CRUDE HONEY",
        "width": 23
      },
      {
        "header": "ORGANIC",
        "width": 9
      },
      {
        "header": "CONVENTIONAL",
        "width": 14
      },
      {
        "header": "SUSTAINABLE",
        "width": 13
      },
      {
        "header": "SIGNED \"SUSTAINABLE BEEKEEPER\" CHARTER (YES/NO)",
        "width": 49
      },
      {
        "header": "Last year of activity",
        "width": 23
      }
    ]
  },
  "beekeepersPotential": {
    "sheetName": "Beekeepers Potential",
    "fileBase": "Beekeepers_Potential_List",
    "columns": [
      {
        "header": "Year",
        "width": 6
      },
      {
        "header": "STANDARD",
        "width": 14
      },
      {
        "header": "Number of Producer Organization",
        "width": 33
      },
      {
        "header": "Number of villages",
        "width": 20
      },
      {
        "header": "Number of beekeepers Men",
        "width": 26
      },
      {
        "header": "Number of beekeepers Women",
        "width": 28
      },
      {
        "header": "Number of beekeepers Youth",
        "width": 28
      },
      {
        "header": "Number of beekeepers CHARTER SIGNED",
        "width": 37
      },
      {
        "header": "Number of hive installed TRADITIONAL SINGLE ENTRY",
        "width": 51
      },
      {
        "header": "Number of hive installed TRADITIONAL DOUBLE ENTRY",
        "width": 51
      },
      {
        "header": "Number of hive installed MODERN",
        "width": 33
      },
      {
        "header": "Number of OTHER hive installed",
        "width": 32
      },
      {
        "header": "HIVE SPREAD PER CROP CASHEW",
        "width": 29
      },
      {
        "header": "HIVE SPREAD PER CROP MANGO",
        "width": 28
      },
      {
        "header": "HIVE SPREAD PER CROP SHEA",
        "width": 27
      },
      {
        "header": "HIVE SPREAD PER CROP FOREST",
        "width": 29
      },
      {
        "header": "HIVE SPREAD OTHER FORAGE",
        "width": 26
      },
      {
        "header": "Number of beekeepers with AT LEAST 1 OTHER HIVE",
        "width": 49
      },
      {
        "header": "Number of beekeepers COMMITMENT beeswax involved",
        "width": 50
      },
      {
        "header": "Number of beekeepers COMMITMENT Honey involved",
        "width": 48
      },
      {
        "header": "Number of beekeepers COMMITMENT Crude Honey involved",
        "width": 54
      },
      {
        "header": "Number of beekeepers with AT LEAST 1 TRADI. SINGLE ENTRY",
        "width": 58
      },
      {
        "header": "Number of beekeepers with AT LEAST 1 TRADI. DOUBLE ENTRY",
        "width": 58
      },
      {
        "header": "Number of beekeepers with AT LEAST 1 MODERN HIVE",
        "width": 50
      }
    ]
  },
  "beekeepersAchieved": {
    "sheetName": "Beekeepers Achieved",
    "fileBase": "Beekeepers_Achieved_List",
    "columns": [
      {
        "header": "Year",
        "width": 6
      },
      {
        "header": "Standard",
        "width": 14
      },
      {
        "header": "Number Of Producer Organization INVOLVED",
        "width": 42
      },
      {
        "header": "Number Of villages INVOLVED",
        "width": 29
      },
      {
        "header": "Number of beekeepers Men INVOLVED",
        "width": 35
      },
      {
        "header": "Number of beekeepers Women INVOLVED",
        "width": 37
      },
      {
        "header": "Number of beekeepers Youth INVOLVED",
        "width": 37
      },
      {
        "header": "Number of beekeepers CHARTER SIGNED INVOLVED",
        "width": 46
      },
      {
        "header": "Number of hive installed TRADITIONAL SINGLE ENTRY INVOLVED",
        "width": 60
      },
      {
        "header": "Number of hive installed TRADITIONAL DOUBLE ENTRY INVOLVED",
        "width": 60
      },
      {
        "header": "Number of hive installed MODERN INVOLVED",
        "width": 42
      },
      {
        "header": "Number of OTHER hive installed INVOLVED",
        "width": 41
      },
      {
        "header": "HIVE SPREAD PER CROP CASHEW INVOLVED",
        "width": 38
      },
      {
        "header": "HIVE SPREAD PER CROP MANGO INVOLVED",
        "width": 37
      },
      {
        "header": "HIVE SPREAD PER CROP SHEA INVOLVED",
        "width": 36
      },
      {
        "header": "HIVE SPREAD PER CROP FOREST INVOLVED",
        "width": 38
      },
      {
        "header": "HIVE SPREAD OTHER FORAGE INVOLVED",
        "width": 35
      },
      {
        "header": "Number of beekeepers TOTAL INVOLVED BROWN BEESWAX",
        "width": 51
      },
      {
        "header": "Number of beekeepers TOTAL INVOLVED YELLOW BEESWAX",
        "width": 52
      },
      {
        "header": "Number of beekeepers TOTAL INVOLVED CRUDE BEESWAX",
        "width": 51
      },
      {
        "header": "Number of beekeepers TOTAL INVOLVED CRUDE HONEY",
        "width": 49
      },
      {
        "header": "Number of beekeepers INVOLVED with AT LEAST 1 TRADI. SINGLE ENTRY",
        "width": 67
      },
      {
        "header": "Number of beekeepers INVOLVED with AT LEAST 1 TRADI. DOUBLE ENTRY",
        "width": 67
      },
      {
        "header": "Number of beekeepers INVOLVED with AT LEAST 1 MODERN HIVE",
        "width": 59
      },
      {
        "header": "Number of beekeepers INVOLVED with AT LEAST 1 OTHER HIVE",
        "width": 58
      }
    ]
  },
  "actorsPotential": {
    "sheetName": "Actor Potential",
    "fileBase": "Actor_Potential_List",
    "columns": [
      {
        "header": "Year",
        "width": 6
      },
      {
        "header": "Traceability code",
        "width": 21
      },
      {
        "header": "Actor name",
        "width": 42
      },
      {
        "header": "Type actor",
        "width": 23
      },
      {
        "header": "Country",
        "width": 9
      },
      {
        "header": "STATE / REGION / DEPARTEMENT",
        "width": 30
      },
      {
        "header": "LGA / MUNICIPALITY / PROVINCE",
        "width": 31
      },
      {
        "header": "Standard",
        "width": 27
      },
      {
        "header": "Number of aggregators",
        "width": 23
      },
      {
        "header": "Number of Producer Organization",
        "width": 33
      },
      {
        "header": "Number of villages",
        "width": 20
      },
      {
        "header": "Number of beekeepers Men",
        "width": 26
      },
      {
        "header": "Number of beekeepers Women",
        "width": 28
      },
      {
        "header": "Number of beekeepers Youth",
        "width": 28
      },
      {
        "header": "Number of beekeepers CHARTER SIGNED",
        "width": 37
      },
      {
        "header": "Number of hive installed TRADITIONAL SINGLE ENTRY",
        "width": 51
      },
      {
        "header": "Number of hive installed TRADITIONAL DOUBLE ENTRY",
        "width": 51
      },
      {
        "header": "Number of hive installed MODERN",
        "width": 33
      },
      {
        "header": "Number of OTHER hive installed",
        "width": 32
      },
      {
        "header": "HIVE SPREAD PER CROP CASHEW",
        "width": 29
      },
      {
        "header": "HIVE SPREAD PER CROP MANGO",
        "width": 28
      },
      {
        "header": "HIVE SPREAD PER CROP SHEA",
        "width": 27
      },
      {
        "header": "HIVE SPREAD PER CROP FOREST",
        "width": 29
      },
      {
        "header": "HIVE SPREAD OTHER FORAGE",
        "width": 26
      },
      {
        "header": "Number of beekeepers with AT LEAST 1 TRADI. SINGLE ENTRY",
        "width": 58
      },
      {
        "header": "Number of beekeepers with AT LEAST 1 TRADI. DOUBLE ENTRY",
        "width": 58
      },
      {
        "header": "Number of beekeepers with AT LEAST 1 MODERN HIVE",
        "width": 50
      },
      {
        "header": "Number of beekeepers with AT LEAST 1 OTHER HIVE",
        "width": 49
      }
    ]
  },
  "contract": {
    "sheetName": "Contracts",
    "fileBase": "Contracts_List",
    "columns": [
      {
        "header": "Year",
        "width": 6
      },
      {
        "header": "Actor traceability code (platform)",
        "width": 36
      },
      {
        "header": "Actor name",
        "width": 42
      },
      {
        "header": "Standard",
        "width": 14
      },
      {
        "header": "Contract Type",
        "width": 15
      },
      {
        "header": "Contract: Currency",
        "width": 20
      },
      {
        "header": "Contract: Beeswax - Brown - Quantity (Kg)",
        "width": 43
      },
      {
        "header": "Contract: Beeswax - Brown - Price",
        "width": 35
      },
      {
        "header": "Contract: Crude Honey - Quantity (Kg)",
        "width": 39
      },
      {
        "header": "Contract: Crude Honey - Price",
        "width": 31
      },
      {
        "header": "Contract: Crude Wax - Quantity (Kg)",
        "width": 37
      },
      {
        "header": "Contract: Crude Wax - Price",
        "width": 29
      },
      {
        "header": "Contract: Honey - Quantity (Kg)",
        "width": 33
      },
      {
        "header": "Contract: Honey - Price",
        "width": 25
      },
      {
        "header": "Contract: Pollen - Quantity (Kg)",
        "width": 34
      },
      {
        "header": "Contract: Pollen - Price",
        "width": 26
      },
      {
        "header": "Contract: Propolis - Quantity (Kg)",
        "width": 36
      },
      {
        "header": "Contract: Propolis - Price",
        "width": 28
      },
      {
        "header": "Contract: Royal Jelly - Quantity (Kg)",
        "width": 39
      },
      {
        "header": "Contract: Royal Jelly - Price",
        "width": 31
      },
      {
        "header": "Contract: Beeswax - Yellow - Quantity (Kg)",
        "width": 44
      },
      {
        "header": "Contract: Beeswax - Yellow - Price",
        "width": 36
      },
      {
        "header": "Contract: Amount advanced",
        "width": 27
      },
      {
        "header": "Actor Type",
        "width": 23
      }
    ]
  },
  "receivedBeekeepers": {
    "sheetName": "Transactions - Received (Beekee",
    "fileBase": "Beekeepers_Transactions_List",
    "columns": [
      {
        "header": "Date of Transaction",
        "width": 21
      },
      {
        "header": "Traceability code (Beekeeper)",
        "width": 31
      },
      {
        "header": "Internal code (Beekeeper)",
        "width": 27
      },
      {
        "header": "Actor name",
        "width": 31
      },
      {
        "header": "Standard",
        "width": 14
      },
      {
        "header": "Product",
        "width": 18
      },
      {
        "header": "Quantity (kg)",
        "width": 15
      },
      {
        "header": "Amount",
        "width": 20
      },
      {
        "header": "Currency",
        "width": 10
      }
    ]
  },
  "receivedActors": {
    "sheetName": "Transactions - Received (Actors",
    "fileBase": "Actor_Transactions_List",
    "columns": [
      {
        "header": "Date of Transaction",
        "width": 21
      },
      {
        "header": "Traceability code (Actor)",
        "width": 27
      },
      {
        "header": "Actor name",
        "width": 42
      },
      {
        "header": "Standard",
        "width": 14
      },
      {
        "header": "Product",
        "width": 18
      },
      {
        "header": "Quantity (kg)",
        "width": 15
      },
      {
        "header": "Amount",
        "width": 20
      },
      {
        "header": "Currency",
        "width": 10
      },
      {
        "header": "Type",
        "width": 23
      }
    ]
  },
  "processing": {
    "sheetName": "Transactions - Processing",
    "fileBase": "Processing_Transactions_List",
    "columns": [
      {
        "header": "Processing Date",
        "width": 17
      },
      {
        "header": "STANDARD",
        "width": 14
      },
      {
        "header": "Initial product",
        "width": 18
      },
      {
        "header": "Initial quantity (kg)",
        "width": 23
      },
      {
        "header": "Product 1 processed",
        "width": 21
      },
      {
        "header": "Quantity 1 processed (kg)",
        "width": 27
      },
      {
        "header": "Product 2 processed",
        "width": 21
      },
      {
        "header": "Quantity 2 processed (kg)",
        "width": 27
      }
    ]
  },
  "sent": {
    "sheetName": "Transactions - Sent",
    "fileBase": "Send_Transactions_List",
    "columns": [
      {
        "header": "Date of Transaction",
        "width": 21
      },
      {
        "header": "Traceability code (Actor)",
        "width": 27
      },
      {
        "header": "Actor name",
        "width": 27
      },
      {
        "header": "Standard",
        "width": 14
      },
      {
        "header": "Product",
        "width": 18
      },
      {
        "header": "Quantity (kg)",
        "width": 15
      },
      {
        "header": "Amount",
        "width": 20
      },
      {
        "header": "Currency",
        "width": 10
      },
      {
        "header": "Type",
        "width": 7
      }
    ]
  },
  "actorsAchieved": {
    "sheetName": "Actor Achieved",
    "fileBase": "Actor_Achieved_List",
    "columns": [
      {
        "header": "Year",
        "width": 6
      },
      {
        "header": "Traceability code",
        "width": 21
      },
      {
        "header": "Actor name",
        "width": 42
      },
      {
        "header": "Type actor",
        "width": 23
      },
      {
        "header": "Country",
        "width": 9
      },
      {
        "header": "STATE / REGION / DEPARTEMENT",
        "width": 30
      },
      {
        "header": "LGA / MUNICIPALITY / PROVINCE",
        "width": 31
      },
      {
        "header": "Standard",
        "width": 27
      },
      {
        "header": "Number of aggregators",
        "width": 23
      },
      {
        "header": "Number of Producer Organization",
        "width": 33
      },
      {
        "header": "Number of villages",
        "width": 20
      },
      {
        "header": "Number of beekeepers Men",
        "width": 26
      },
      {
        "header": "Number of beekeepers Women",
        "width": 28
      },
      {
        "header": "Number of beekeepers Youth",
        "width": 28
      },
      {
        "header": "Number of beekeepers CHARTER SIGNED",
        "width": 37
      },
      {
        "header": "Number of hive installed TRADITIONAL SINGLE ENTRY",
        "width": 51
      },
      {
        "header": "Number of hive installed TRADITIONAL DOUBLE ENTRY",
        "width": 51
      },
      {
        "header": "Number of hive installed MODERN",
        "width": 33
      },
      {
        "header": "Number of OTHER hive installed",
        "width": 32
      },
      {
        "header": "HIVE SPREAD PER CROP CASHEW",
        "width": 29
      },
      {
        "header": "HIVE SPREAD PER CROP MANGO",
        "width": 28
      },
      {
        "header": "HIVE SPREAD PER CROP SHEA",
        "width": 27
      },
      {
        "header": "HIVE SPREAD PER CROP FOREST",
        "width": 29
      },
      {
        "header": "HIVE SPREAD OTHER FORAGE",
        "width": 26
      },
      {
        "header": "Number of beekeepers with AT LEAST 1 TRADI. SINGLE ENTRY",
        "width": 58
      },
      {
        "header": "Number of beekeepers with AT LEAST 1 TRADI. DOUBLE ENTRY",
        "width": 58
      },
      {
        "header": "Number of beekeepers with AT LEAST 1 MODERN HIVE",
        "width": 50
      },
      {
        "header": "Number of beekeepers with AT LEAST 1 OTHER HIVE",
        "width": 49
      }
    ]
  }
};


export const STANDARDS_ORDER = ['Sustainable', 'Organic', 'Conventional'];

// Old MIS spelling of product names ("Beeswax - Yellow"); the app stores
// "Beeswax-Yellow".
export function displayProduct(p) {
  if (!p) return '-';
  return String(p).replace(/\s*-\s*/g, ' - ');
}

const dash = (v) => (v === null || v === undefined || v === '' ? '-' : v);
const yesNo = (b) => (b ? 'Yes' : 'No');
const yearOf = (d) => (d ? new Date(d).getUTCFullYear() : null);

// DD/MM/YYYY text, exactly as the old exports wrote dates.
export function ddmmyyyy(d) {
  if (!d) return '-';
  const s = String(d).slice(0, 10); // YYYY-MM-DD
  const [y, m, day] = s.split('-');
  return y && m && day ? `${day}/${m}/${y}` : '-';
}

const sum = (list, key) => list.reduce((acc, b) => acc + (Number(b[key]) || 0), 0);
const countWhere = (list, fn) => list.filter(fn).length;
const hasStd = (b, std) => (b.standards || []).includes(std);
const isYouth = (b, year) => b.year_of_birth != null && year - Number(b.year_of_birth) <= 35;
const distinctVillages = (list) => new Set(list.map((b) => b.village_id).filter(Boolean)).size;
const hasPO = (b) => !!(b.linked_producer_organisation && String(b.linked_producer_organisation).trim());

function yearsBetween(start, end) {
  const out = [];
  for (let y = Number(start); y <= Number(end); y++) out.push(y);
  return out;
}

// Shared hive/forage/at-least-one block used by several summary reports.
function hiveFigures(list, headers) {
  const [single, double, modern, other, cashew, mango, shea, forest, otherForage] = headers;
  return {
    [single]: sum(list, 'hives_traditional_single'),
    [double]: sum(list, 'hives_traditional_double'),
    [modern]: sum(list, 'hives_modern'),
    [other]: sum(list, 'hives_other'),
    [cashew]: sum(list, 'hive_cashew'),
    [mango]: sum(list, 'hive_mango'),
    [shea]: sum(list, 'hive_shea'),
    [forest]: sum(list, 'hive_forest'),
    [otherForage]: sum(list, 'hive_other_forage'),
  };
}

// ---------- Row builders ----------
// Each returns an array of objects keyed by the template's exact header.
// data: { beekeepers, villagesById, transactions, actors, connections, contracts }
// Beekeepers carry created_at, standards[], commitment[], hive columns, etc.

function beekeeperListRows({ beekeepers, villagesById, transactions }, { year }) {
  const lastActivity = {};
  for (const t of transactions) {
    if (!t.beekeeper_id) continue;
    const y = yearOf(t.transaction_date);
    if (y && (!lastActivity[t.beekeeper_id] || y > lastActivity[t.beekeeper_id])) lastActivity[t.beekeeper_id] = y;
  }
  return beekeepers
    .filter((b) => yearOf(b.created_at) <= Number(year))
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
    .map((b) => {
      const v = villagesById[b.village_id] || {};
      const c = b.commitment || [];
      return {
        YEAR: yearOf(b.created_at),
        'TRACEABILITY CODE': dash(b.traceability_code),
        'INTERNAL CODE': dash(b.internal_code),
        'BEEKEEPER NAME': dash(b.full_name),
        'GENDER (M/F/O)': dash(b.gender),
        'YEAR OF BIRTH': dash(b.year_of_birth),
        'NATIONAL ID NUMBER': dash(b.national_id),
        'PRODUCER ORGANIZATION': dash(b.linked_producer_organisation),
        'PHONE NUMBER': dash(b.contact_phone),
        VILLAGE: dash(v.name),
        'LGA / MUNICIPALITY / PROVINCE': dash(v.lga_municipality),
        'STATE / REGION / DEPARTEMENT': dash(v.state_region),
        COUNTRY: dash(v.country),
        'TRADITIONAL SINGLE ENTRY': Number(b.hives_traditional_single) || 0,
        'TRADITIONAL DOUBLE ENTRY': Number(b.hives_traditional_double) || 0,
        MODERN: Number(b.hives_modern) || 0,
        'OTHER HIVE': Number(b.hives_other) || 0,
        CASHEW: Number(b.hive_cashew) || 0,
        MANGO: Number(b.hive_mango) || 0,
        SHEA: Number(b.hive_shea) || 0,
        FOREST: Number(b.hive_forest) || 0,
        'OTHER FORAGE': Number(b.hive_other_forage) || 0,
        'DELIVERED BEESWAX': yesNo(c.includes('Beeswax')),
        'DELIVERED HONEY': yesNo(c.includes('Honey')),
        'DELIVERED CRUDE HONEY': yesNo(c.includes('Crude honey')),
        ORGANIC: yesNo(hasStd(b, 'Organic')),
        CONVENTIONAL: yesNo(hasStd(b, 'Conventional')),
        SUSTAINABLE: yesNo(hasStd(b, 'Sustainable')),
        'SIGNED "SUSTAINABLE BEEKEEPER" CHARTER (YES/NO)': yesNo(b.charter_signed),
        'Last year of activity': dash(lastActivity[b.id]),
      };
    });
}

function beekeepersPotentialRows({ beekeepers }, { startYear, endYear, standards }) {
  const stds = standards?.length ? STANDARDS_ORDER.filter((s) => standards.includes(s)) : STANDARDS_ORDER;
  const rows = [];
  for (const year of yearsBetween(startYear, endYear)) {
    for (const std of stds) {
      const c = beekeepers.filter((b) => yearOf(b.created_at) <= year && hasStd(b, std));
      rows.push({
        Year: year,
        STANDARD: std.toUpperCase(),
        'Number of Producer Organization': new Set(c.filter(hasPO).map((b) => b.linked_producer_organisation.trim())).size,
        'Number of villages': distinctVillages(c),
        'Number of beekeepers Men': countWhere(c, (b) => b.gender === 'Male'),
        'Number of beekeepers Women': countWhere(c, (b) => b.gender === 'Female'),
        'Number of beekeepers Youth': countWhere(c, (b) => isYouth(b, year)),
        'Number of beekeepers CHARTER SIGNED': countWhere(c, (b) => b.charter_signed),
        ...hiveFigures(c, ['Number of hive installed TRADITIONAL SINGLE ENTRY', 'Number of hive installed TRADITIONAL DOUBLE ENTRY', 'Number of hive installed MODERN', 'Number of OTHER hive installed', 'HIVE SPREAD PER CROP CASHEW', 'HIVE SPREAD PER CROP MANGO', 'HIVE SPREAD PER CROP SHEA', 'HIVE SPREAD PER CROP FOREST', 'HIVE SPREAD OTHER FORAGE']),
        'Number of beekeepers with AT LEAST 1 OTHER HIVE': countWhere(c, (b) => b.hives_other > 0),
        'Number of beekeepers COMMITMENT beeswax involved': countWhere(c, (b) => (b.commitment || []).includes('Beeswax')),
        'Number of beekeepers COMMITMENT Honey involved': countWhere(c, (b) => (b.commitment || []).includes('Honey')),
        'Number of beekeepers COMMITMENT Crude Honey involved': countWhere(c, (b) => (b.commitment || []).includes('Crude honey')),
        'Number of beekeepers with AT LEAST 1 TRADI. SINGLE ENTRY': countWhere(c, (b) => b.hives_traditional_single > 0),
        'Number of beekeepers with AT LEAST 1 TRADI. DOUBLE ENTRY': countWhere(c, (b) => b.hives_traditional_double > 0),
        'Number of beekeepers with AT LEAST 1 MODERN HIVE': countWhere(c, (b) => b.hives_modern > 0),
      });
    }
  }
  return rows;
}

// Beekeeper deliveries per year: { [year]: { [beekeeperId]: Set(products) } }
function deliveriesByYear(transactions) {
  const out = {};
  for (const t of transactions) {
    if (!t.beekeeper_id || t.direction !== 'Received') continue;
    const y = yearOf(t.transaction_date);
    if (!y) continue;
    out[y] = out[y] || {};
    out[y][t.beekeeper_id] = out[y][t.beekeeper_id] || new Set();
    out[y][t.beekeeper_id].add(t.product);
  }
  return out;
}

function beekeepersAchievedRows({ beekeepers, transactions }, { startYear, endYear, standards }) {
  const stds = standards?.length ? STANDARDS_ORDER.filter((s) => standards.includes(s)) : STANDARDS_ORDER;
  const delivered = deliveriesByYear(transactions);
  const rows = [];
  for (const year of yearsBetween(startYear, endYear)) {
    const inYear = delivered[year] || {};
    for (const std of stds) {
      const c = beekeepers.filter((b) => inYear[b.id] && hasStd(b, std));
      const withProduct = (p) => countWhere(c, (b) => inYear[b.id].has(p));
      rows.push({
        Year: year,
        Standard: std.toUpperCase(),
        'Number Of Producer Organization INVOLVED': countWhere(c, hasPO),
        'Number Of villages INVOLVED': distinctVillages(c),
        'Number of beekeepers Men INVOLVED': countWhere(c, (b) => b.gender === 'Male'),
        'Number of beekeepers Women INVOLVED': countWhere(c, (b) => b.gender === 'Female'),
        'Number of beekeepers Youth INVOLVED': countWhere(c, (b) => isYouth(b, year)),
        'Number of beekeepers CHARTER SIGNED INVOLVED': countWhere(c, (b) => b.charter_signed),
        ...hiveFigures(c, ['Number of hive installed TRADITIONAL SINGLE ENTRY INVOLVED', 'Number of hive installed TRADITIONAL DOUBLE ENTRY INVOLVED', 'Number of hive installed MODERN INVOLVED', 'Number of OTHER hive installed INVOLVED', 'HIVE SPREAD PER CROP CASHEW INVOLVED', 'HIVE SPREAD PER CROP MANGO INVOLVED', 'HIVE SPREAD PER CROP SHEA INVOLVED', 'HIVE SPREAD PER CROP FOREST INVOLVED', 'HIVE SPREAD OTHER FORAGE INVOLVED']),
        'Number of beekeepers TOTAL INVOLVED BROWN BEESWAX': withProduct('Beeswax-Brown'),
        'Number of beekeepers TOTAL INVOLVED YELLOW BEESWAX': withProduct('Beeswax-Yellow'),
        'Number of beekeepers TOTAL INVOLVED CRUDE BEESWAX': withProduct('Crude Wax'),
        'Number of beekeepers TOTAL INVOLVED CRUDE HONEY': withProduct('Crude Honey'),
        'Number of beekeepers INVOLVED with AT LEAST 1 TRADI. SINGLE ENTRY': countWhere(c, (b) => b.hives_traditional_single > 0),
        'Number of beekeepers INVOLVED with AT LEAST 1 TRADI. DOUBLE ENTRY': countWhere(c, (b) => b.hives_traditional_double > 0),
        'Number of beekeepers INVOLVED with AT LEAST 1 MODERN HIVE': countWhere(c, (b) => b.hives_modern > 0),
        'Number of beekeepers INVOLVED with AT LEAST 1 OTHER HIVE': countWhere(c, (b) => b.hives_other > 0),
      });
    }
  }
  return rows;
}

// Actor summaries: one row per year per supplier actor (Aggregators,
// Producer Organisations, Local Partners -- not Buyers), built from the
// beekeepers that belong to that actor. Achieved counts only those
// beekeepers who delivered in the year (explicit decision: same columns
// as Actor Potential).
function actorRows({ beekeepers, transactions, actors, connections }, { startYear, endYear }, achieved) {
  const delivered = achieved ? deliveriesByYear(transactions) : null;
  const actorById = Object.fromEntries(actors.map((a) => [a.id, a]));
  const suppliers = actors.filter((a) => a.actor_type !== 'Buyer');
  const partners = {};
  for (const c of connections || []) {
    if (c.status && c.status !== 'Active') continue;
    for (const [a, b] of [[c.actor_from_id, c.actor_to_id], [c.actor_to_id, c.actor_from_id]]) {
      partners[a] = partners[a] || new Set();
      partners[a].add(b);
    }
  }
  const partnerCount = (id, type) => [...(partners[id] || [])].filter((p) => actorById[p]?.actor_type === type).length;
  const rows = [];
  for (const year of yearsBetween(startYear, endYear)) {
    for (const a of suppliers.sort((x, y) => String(y.traceability_code).localeCompare(String(x.traceability_code)))) {
      if (yearOf(a.created_at) > year) continue;
      let c = beekeepers.filter((b) => b.actor_id === a.id && yearOf(b.created_at) <= year);
      if (achieved) c = c.filter((b) => (delivered[year] || {})[b.id]);
      rows.push({
        Year: year,
        'Traceability code': dash(a.traceability_code),
        'Actor name': dash(a.contact_name?.trim()),
        'Type actor': dash(a.actor_type),
        Country: dash(a.country),
        'STATE / REGION / DEPARTEMENT': dash(a.state_region),
        'LGA / MUNICIPALITY / PROVINCE': dash(a.lga_municipality),
        Standard: (a.standards || []).length ? [...a.standards].sort().join(', ') : '-',
        'Number of aggregators': partnerCount(a.id, 'Aggregator'),
        'Number of Producer Organization': partnerCount(a.id, 'Producer Organisation'),
        'Number of villages': distinctVillages(c),
        'Number of beekeepers Men': countWhere(c, (b) => b.gender === 'Male'),
        'Number of beekeepers Women': countWhere(c, (b) => b.gender === 'Female'),
        'Number of beekeepers Youth': countWhere(c, (b) => isYouth(b, year)),
        'Number of beekeepers CHARTER SIGNED': countWhere(c, (b) => b.charter_signed),
        ...hiveFigures(c, ['Number of hive installed TRADITIONAL SINGLE ENTRY', 'Number of hive installed TRADITIONAL DOUBLE ENTRY', 'Number of hive installed MODERN', 'Number of OTHER hive installed', 'HIVE SPREAD PER CROP CASHEW', 'HIVE SPREAD PER CROP MANGO', 'HIVE SPREAD PER CROP SHEA', 'HIVE SPREAD PER CROP FOREST', 'HIVE SPREAD OTHER FORAGE']),
        'Number of beekeepers with AT LEAST 1 TRADI. SINGLE ENTRY': countWhere(c, (b) => b.hives_traditional_single > 0),
        'Number of beekeepers with AT LEAST 1 TRADI. DOUBLE ENTRY': countWhere(c, (b) => b.hives_traditional_double > 0),
        'Number of beekeepers with AT LEAST 1 MODERN HIVE': countWhere(c, (b) => b.hives_modern > 0),
        'Number of beekeepers with AT LEAST 1 OTHER HIVE': countWhere(c, (b) => b.hives_other > 0),
      });
    }
  }
  return rows;
}

const CONTRACT_PRODUCTS = ['Beeswax-Brown', 'Crude Honey', 'Crude Wax', 'Honey', 'Pollen', 'Propolis', 'Royal Jelly', 'Beeswax-Yellow'];

function contractRows({ contracts }, { products }) {
  const groups = {};
  for (const c of contracts) {
    const k = c.contract_group_id || c.id;
    (groups[k] = groups[k] || []).push(c);
  }
  return Object.values(groups)
    .filter((lines) => !products?.length || lines.some((l) => products.includes(l.product)))
    .sort((a, b) => (b[0].year || 0) - (a[0].year || 0))
    .map((lines) => {
      const first = lines[0];
      const row = {
        Year: dash(first.year),
        'Actor traceability code (platform)': dash(first.actors?.traceability_code),
        'Actor name': dash(first.actors?.contact_name?.trim()),
        Standard: dash(first.standard),
        'Contract Type': first.contract_type === 'Send' ? 'Sent' : dash(first.contract_type),
        'Contract: Currency': dash(first.currency),
      };
      for (const p of CONTRACT_PRODUCTS) {
        const line = lines.find((l) => l.product === p);
        row[`Contract: ${displayProduct(p)} - Quantity (Kg)`] = line ? Number(line.expected_quantity) || 0 : 0;
        row[`Contract: ${displayProduct(p)} - Price`] = line ? Number(line.price) || 0 : 0;
      }
      row['Contract: Amount advanced'] = Number(first.advance_amount_paid) || 0;
      row['Actor Type'] = dash(first.actors?.actor_type);
      return row;
    });
}

const byDateDesc = (a, b) => String(b.transaction_date).localeCompare(String(a.transaction_date));

function receivedBeekeepersRows({ transactions }, _f, translate) {
  return transactions.filter((t) => t.direction === 'Received' && t.beekeeper_id).sort(byDateDesc).map((t) => ({
    'Date of Transaction': ddmmyyyy(t.transaction_date),
    'Traceability code (Beekeeper)': dash(t.beekeepers?.traceability_code),
    'Internal code (Beekeeper)': dash(t.beekeepers?.internal_code),
    'Actor name': dash(t.beekeepers?.full_name),
    Standard: dash(translate.standard(t.standard)),
    Product: translate.product(t.product),
    'Quantity (kg)': Number(t.quantity) || 0,
    Amount: t.total_amount != null ? Number(t.total_amount) : '-',
    Currency: dash(t.currency),
  }));
}

function actorTransactionRows({ transactions }, _f, translate, direction) {
  return transactions.filter((t) => t.direction === direction && t.actor_id && (direction === 'Send' || !t.beekeeper_id)).sort(byDateDesc).map((t) => ({
    'Date of Transaction': ddmmyyyy(t.transaction_date),
    'Traceability code (Actor)': dash(t.actors?.traceability_code),
    'Actor name': dash(t.actors?.contact_name?.trim()),
    Standard: dash(translate.standard(t.standard)),
    Product: translate.product(t.product),
    'Quantity (kg)': Number(t.quantity) || 0,
    Amount: t.total_amount != null ? Number(t.total_amount) : '-',
    Currency: dash(t.currency),
    Type: dash(t.actors?.actor_type),
  }));
}

function processingRows({ transactions }, { products }) {
  const groups = {};
  for (const t of transactions) {
    if (t.direction !== 'Processing') continue;
    const k = t.transaction_group_id || t.id;
    (groups[k] = groups[k] || []).push(t);
  }
  const all = Object.values(groups)
    .filter((g) => !products?.length || g.some((t) => products.includes(t.product) || products.includes(t.source_product)))
    .sort((a, b) => byDateDesc(a[0], b[0]));
  const maxOutputs = Math.max(2, ...all.map((g) => g.length));
  return all.map((g) => {
    const first = g[0];
    const row = {
      'Processing Date': ddmmyyyy(first.transaction_date),
      STANDARD: dash(first.standard),
      'Initial product': displayProduct(first.source_product),
      'Initial quantity (kg)': first.source_quantity != null ? Number(first.source_quantity) : '-',
    };
    for (let i = 0; i < maxOutputs; i++) {
      row[`Product ${i + 1} processed`] = g[i] ? displayProduct(g[i].product) : '-';
      row[`Quantity ${i + 1} processed (kg)`] = g[i] ? Number(g[i].quantity) || 0 : '-';
    }
    return row;
  });
}

const IDENTITY = { product: displayProduct, standard: (s) => s };

export function buildReport(key, data, filters = {}, translate = IDENTITY) {
  const template = REPORT_TEMPLATES[key];
  if (!template) throw new Error(`Unknown report: ${key}`);
  let rows;
  switch (key) {
    case 'beekeeperList': rows = beekeeperListRows(data, filters); break;
    case 'beekeepersPotential': rows = beekeepersPotentialRows(data, filters); break;
    case 'beekeepersAchieved': rows = beekeepersAchievedRows(data, filters); break;
    case 'actorsPotential': rows = actorRows(data, filters, false); break;
    case 'actorsAchieved': rows = actorRows(data, filters, true); break;
    case 'contract': rows = contractRows(data, filters); break;
    case 'receivedBeekeepers': rows = receivedBeekeepersRows(data, filters, translate); break;
    case 'receivedActors': rows = actorTransactionRows(data, filters, translate, 'Received'); break;
    case 'sent': rows = actorTransactionRows(data, filters, translate, 'Send'); break;
    case 'processing': rows = processingRows(data, filters); break;
    default: throw new Error(`No builder for ${key}`);
  }
  // Processing can have more than two outputs per batch; the old layout
  // stops at two, so extra output columns are added rather than dropping
  // real data.
  let columns = template.columns;
  if (key === 'processing' && rows.length) {
    const extra = Object.keys(rows[0]).filter((h) => !columns.some((c) => c.header === h));
    columns = [...columns, ...extra.map((h) => ({ header: h, width: h.startsWith('Product') ? 21 : 27 }))];
  }
  return { sheetName: template.sheetName, fileBase: template.fileBase, columns, rows };
}

// Old MIS look: Calibri 11, bold header row, no fill, no frozen panes.
export async function reportToXlsxBlob({ sheetName, columns, rows }) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.header, width: c.width }));
  sheet.getRow(1).font = { bold: true };
  rows.forEach((r) => sheet.addRow(columns.map((c) => (r[c.header] === undefined ? '-' : r[c.header]))));
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// e.g. "Beekeepers_List_OLD_LEVI_MULTIBIZ_SERVICES_LTD.xlsx"
export function reportFileName(fileBase, orgName) {
  const org = String(orgName || 'REPORT').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
  return `${fileBase}_${org}.xlsx`;
}
