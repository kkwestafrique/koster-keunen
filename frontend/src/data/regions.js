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
