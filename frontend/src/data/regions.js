// Static reference data for the KKWA MIS, captured from the live miskkwa.com
// platform audit (July 2026). Countries/currencies/products/units match the
// live dropdowns exactly. States are complete per country; LGA lists are
// seeded for the Nigerian states observed in live data (Kaduna, Benue, Lagos,
// Kebbi) — the AddressFields component falls back to free text where no LGA
// list exists yet. Extend LGAS_BY_STATE as more data becomes available.

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

export const ACTOR_TYPES = ['Local partner', 'Aggregator', 'Producer organisation'];

export const STATES_BY_COUNTRY = {
  Nigeria: [
    'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue',
    'Borno', 'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu',
    'FCT Abuja', 'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina',
    'Kebbi', 'Kogi', 'Kwara', 'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo',
    'Osun', 'Oyo', 'Plateau', 'Rivers', 'Sokoto', 'Taraba', 'Yobe', 'Zamfara',
  ],
  Ghana: [
    'Ahafo', 'Ashanti', 'Bono', 'Bono East', 'Central', 'Eastern',
    'Greater Accra', 'North East', 'Northern', 'Oti', 'Savannah',
    'Upper East', 'Upper West', 'Volta', 'Western', 'Western North',
  ],
  Benin: [
    'Alibori', 'Atacora', 'Atlantique', 'Borgou', 'Collines', 'Couffo',
    'Donga', 'Littoral', 'Mono', 'Ouémé', 'Plateau', 'Zou',
  ],
  'Burkina Faso': [
    'Boucle du Mouhoun', 'Cascades', 'Centre', 'Centre-Est', 'Centre-Nord',
    'Centre-Ouest', 'Centre-Sud', 'Est', 'Hauts-Bassins', 'Nord',
    'Plateau-Central', 'Sahel', 'Sud-Ouest',
  ],
  "Côte d'Ivoire": [
    'Abidjan', 'Bas-Sassandra', 'Comoé', 'Denguélé', 'Gôh-Djiboua', 'Lacs',
    'Lagunes', 'Montagnes', 'Sassandra-Marahoué', 'Savanes', 'Vallée du Bandama',
    'Woroba', 'Yamoussoukro', 'Zanzan',
  ],
  Mali: [
    'Bamako', 'Gao', 'Kayes', 'Kidal', 'Koulikoro', 'Ménaka', 'Mopti',
    'Ségou', 'Sikasso', 'Taoudénit', 'Tombouctou',
  ],
  'Sierra Leone': [
    'Eastern Province', 'North West Province', 'Northern Province',
    'Southern Province', 'Western Area',
  ],
  Togo: ['Centrale', 'Kara', 'Maritime', 'Plateaux', 'Savanes'],
};

// LGA / Municipality lists per state. Seeded for the Nigerian states seen in
// live data. Free-text fallback applies to any state not listed here.
export const LGAS_BY_STATE = {
  Kaduna: [
    'Birnin Gwari', 'Chikun', 'Giwa', 'Igabi', 'Ikara', 'Jaba', "Jema'a",
    'Kachia', 'Kaduna North', 'Kaduna South', 'Kagarko', 'Kajuru', 'Kaura',
    'Kauru', 'Kubau', 'Kudan', 'Lere', 'Makarfi', 'Sabon Gari', 'Sanga',
    'Soba', 'Zangon Kataf', 'Zaria',
  ],
  Benue: [
    'Ado', 'Agatu', 'Apa', 'Buruku', 'Gboko', 'Guma', 'Gwer East',
    'Gwer West', 'Katsina-Ala', 'Konshisha', 'Kwande', 'Logo', 'Makurdi',
    'Obi', 'Ogbadibo', 'Ohimini', 'Oju', 'Okpokwu', 'Otukpo', 'Tarka',
    'Ukum', 'Ushongo', 'Vandeikya',
  ],
  Lagos: [
    'Agege', 'Ajeromi-Ifelodun', 'Alimosho', 'Amuwo-Odofin', 'Apapa',
    'Badagry', 'Epe', 'Eti-Osa', 'Ibeju-Lekki', 'Ifako-Ijaiye', 'Ikeja',
    'Ikorodu', 'Kosofe', 'Lagos Island', 'Lagos Mainland', 'Mushin', 'Ojo',
    'Oshodi-Isolo', 'Shomolu', 'Surulere',
  ],
  Kebbi: [
    'Aleiro', 'Arewa Dandi', 'Argungu', 'Augie', 'Bagudo', 'Birnin Kebbi',
    'Bunza', 'Dandi', 'Fakai', 'Gwandu', 'Jega', 'Kalgo', 'Koko/Besse',
    'Maiyama', 'Ngaski', 'Sakaba', 'Shanga', 'Suru', 'Wasagu/Danko', 'Yauri',
    'Zuru',
  ],
};

export function getStatesForCountry(country) {
  return STATES_BY_COUNTRY[country] || [];
}

export function getLgasForState(state) {
  return LGAS_BY_STATE[state] || [];
}
