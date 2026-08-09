// Static reference data for the KKWA MIS, captured from the live miskkwa.com
// platform audit (July 2026). Countries/currencies/products/units match the
// live dropdowns exactly. States and LGA/commune/province data used to be
// hardcoded here too, but now lives in Supabase's `regions` table instead —
// see the note at the bottom of this file and src/hooks/useRegions.js.

export const COUNTRIES = [
  'Benin',
  'Burkina Faso',
  "Côte d'Ivoire",
  'Ghana',
  'Mali',
  'Nigeria',
  'Sierra Leone',
  'Togo',
];

export const CURRENCIES = ['GHS', 'NGN', 'SLL', 'USD', 'XOF'];

// Auto-fills the Create Contract wizard's Currency field when a supplier
// is selected, based on the supplier's country (audit: "selecting a
// supplier auto-filled Currency (Floxy Ventures -> NGN)"). XOF (CFA franc)
// is shared across several West African countries; USD isn't tied to any
// single supported country and is only ever chosen manually.
export const COUNTRY_CURRENCY = {
  Nigeria: 'NGN',
  Ghana: 'GHS',
  'Sierra Leone': 'SLL',
  Benin: 'XOF',
  'Burkina Faso': 'XOF',
  "Côte d'Ivoire": 'XOF',
  Mali: 'XOF',
  Togo: 'XOF',
};

export const PRODUCTS = [
  'Royal Jelly',
  'Pollen',
  'Propolis',
  'Crude Honey',
  'Crude Wax',
  'Beeswax-Brown',
  'Beeswax-Yellow',
  'Honey',
];

export const UNITS = ['Kg'];

export const STANDARDS = ['Sustainable', 'Organic', 'Conventional'];

// "Commitment of beekeeper" checkboxes on the Add Beekeeper form (distinct
// from PRODUCTS above — this is a 3-item declaration, not the full
// transaction product catalog). Casing matches the live site exactly
// ("Crude honey" lowercase h, vs PRODUCTS' "Crude Honey").
export const COMMITMENT_OF_BEEKEEPER = ['Crude honey', 'Honey', 'Beeswax'];

// "Number of hives spread per crop" inputs on the Add Beekeeper form.
export const HIVE_SPREAD_CROPS = ['Cashew', 'Mango', 'Shea', 'Forest', 'Other forage'];

export const TEAM_ROLES = ['Admin', 'Member', 'Field Officer'];

// Must match the exact values in the `actors.actor_type` CHECK constraint
// and the seeded `constants` table (category='actor_type') in Supabase.
// ('Buyer' is also a valid DB value but isn't offered here — it's not one
// of the three options shown in the live site's Edit Actor radio buttons.)
export const ACTOR_TYPES = ['Local Partner', 'Aggregator', 'Producer Organisation'];

// NOTE: States and LGA/commune/province data used to live here as
// STATES_BY_COUNTRY / LGAS_BY_STATE. That data now lives in the `regions`
// table in Supabase instead (see migration `create_regions_table` /
// `seed_regions_data`), so corrections and additions (e.g. eventually
// populating Ghana's districts) can be made directly in the database
// without a code deploy. See src/hooks/useRegions.js for the query hooks
// that replaced getStatesForCountry() / getLgasForState().
