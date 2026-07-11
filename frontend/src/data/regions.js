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

// Must match the exact values in the `actors.actor_type` CHECK constraint
// and the seeded `constants` table (category='actor_type') in Supabase.
// ('Buyer' is also a valid DB value but isn't offered here — it's not one
// of the three options shown in the live site's Edit Actor radio buttons.)
export const ACTOR_TYPES = ['Local Partner', 'Aggregator', 'Producer Organisation'];

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
// LGA / Municipality lists per state/region.
//
// Nigeria: complete — all 774 LGAs across all 36 states + FCT. Well-
// established public administrative data (NBS/INEC), high confidence.
//
// Sierra Leone: complete — all 16 districts, high confidence (small,
// well-known list).
//
// Benin: complete — all 77 communes across all 12 departments. Stable,
// well-documented administrative structure, high confidence.
//
// Burkina Faso: complete — all 45 provinces across all 13 regions. Stable,
// well-documented, high confidence.
//
// Togo: complete — prefectures across all 5 regions. Moderate-high
// confidence; a couple of newer prefecture splits (post-2020) may not be
// reflected — worth a spot-check.
//
// Mali: cercles populated for the original 8 regions + Bamako. MODERATE
// confidence — Mali's 2016 administrative reorganization split some of
// these into additional regions (Ménaka, Taoudénit, and others); this data
// reflects the older, more stable structure and should be verified against
// current official sources before relying on it for the newer regions.
//
// Côte d'Ivoire: regions populated under each district. LOWER confidence —
// Côte d'Ivoire's district/region/department boundaries have been
// reorganized multiple times (1997, 2011, and since), and department-level
// data was NOT populated here (108+ departments, high volatility) —
// falls back to free text at that level.
//
// Ghana: NOT populated at district level. Ghana's MMDAs (Metropolitan/
// Municipal/District Assemblies) have grown from ~216 to 261+ through
// frequent splits, making this the highest-risk dataset to hand-populate
// accurately. Falls back to free text until an authoritative source
// (Ghana Statistical Service / official gazette) is supplied.
// LGA / Municipality lists, nested by COUNTRY then STATE/REGION. Nesting by
// country is required — several countries share identical region names
// (e.g. Nigeria's "Plateau" state vs Benin's "Plateau" department; Côte
// d'Ivoire's "Savanes" region vs Togo's "Savanes" region), so a flat
// state-name lookup would silently return the wrong country's data.
//
// Nigeria: complete — all 774 LGAs across all 36 states + FCT. Well-
// established public administrative data (NBS/INEC), high confidence.
//
// Sierra Leone: complete — all 16 districts, high confidence (small,
// well-known list).
//
// Benin: complete — all 77 communes across all 12 departments. Stable,
// well-documented administrative structure, high confidence.
//
// Burkina Faso: complete — all 45 provinces across all 13 regions. Stable,
// well-documented, high confidence.
//
// Togo: complete — prefectures across all 5 regions. Moderate-high
// confidence; a couple of newer prefecture splits (post-2020) may not be
// reflected — worth a spot-check.
//
// Mali: cercles populated for the original 8 regions + Bamako. MODERATE
// confidence — Mali's 2016 administrative reorganization split some of
// these into additional regions (Ménaka, Taoudénit, and others); this data
// reflects the older, more stable structure and should be verified against
// current official sources before relying on it for the newer regions.
//
// Côte d'Ivoire: regions populated under each district. LOWER confidence —
// Côte d'Ivoire's district/region/department boundaries have been
// reorganized multiple times (1997, 2011, and since), and department-level
// data was NOT populated here (108+ departments, high volatility) —
// falls back to free text at that level.
//
// Ghana: NOT populated at district level. Ghana's MMDAs (Metropolitan/
// Municipal/District Assemblies) have grown from ~216 to 261+ through
// frequent splits, making this the highest-risk dataset to hand-populate
// accurately. Falls back to free text until an authoritative source
// (Ghana Statistical Service / official gazette) is supplied.
export const LGAS_BY_STATE = {
  Nigeria: {
    Abia: ['Aba North', 'Aba South', 'Arochukwu', 'Bende', 'Ikwuano', 'Isiala Ngwa North', 'Isiala Ngwa South', 'Isuikwuato', 'Obi Ngwa', 'Ohafia', 'Osisioma', 'Ugwunagbo', 'Ukwa East', 'Ukwa West', 'Umuahia North', 'Umuahia South', 'Umu Nneochi'],
    Adamawa: ['Demsa', 'Fufure', 'Ganye', 'Girei', 'Gombi', 'Guyuk', 'Hong', 'Jada', 'Lamurde', 'Madagali', 'Maiha', 'Mayo-Belwa', 'Michika', 'Mubi North', 'Mubi South', 'Numan', 'Shelleng', 'Song', 'Toungo', 'Yola North', 'Yola South'],
    'Akwa Ibom': ['Abak', 'Eastern Obolo', 'Eket', 'Esit Eket', 'Essien Udim', 'Etim Ekpo', 'Etinan', 'Ibeno', 'Ibesikpo Asutan', 'Ibiono-Ibom', 'Ika', 'Ikono', 'Ikot Abasi', 'Ikot Ekpene', 'Ini', 'Itu', 'Mbo', 'Mkpat-Enin', 'Nsit-Atai', 'Nsit-Ibom', 'Nsit-Ubium', 'Obot Akara', 'Okobo', 'Onna', 'Oron', 'Oruk Anam', 'Udung-Uko', 'Ukanafun', 'Uruan', 'Urue-Offong/Oruko', 'Uyo'],
    Anambra: ['Aguata', 'Anambra East', 'Anambra West', 'Anaocha', 'Awka North', 'Awka South', 'Ayamelum', 'Dunukofia', 'Ekwusigo', 'Idemili North', 'Idemili South', 'Ihiala', 'Njikoka', 'Nnewi North', 'Nnewi South', 'Ogbaru', 'Onitsha North', 'Onitsha South', 'Orumba North', 'Orumba South', 'Oyi'],
    Bauchi: ['Alkaleri', 'Bauchi', 'Bogoro', 'Dambam', 'Darazo', 'Dass', 'Gamawa', 'Ganjuwa', 'Giade', 'Itas/Gadau', "Jama'are", 'Katagum', 'Kirfi', 'Misau', 'Ningi', 'Shira', 'Tafawa Balewa', 'Toro', 'Warji', 'Zaki'],
    Bayelsa: ['Brass', 'Ekeremor', 'Kolokuma/Opokuma', 'Nembe', 'Ogbia', 'Sagbama', 'Southern Ijaw', 'Yenagoa'],
    Benue: ['Ado', 'Agatu', 'Apa', 'Buruku', 'Gboko', 'Guma', 'Gwer East', 'Gwer West', 'Katsina-Ala', 'Konshisha', 'Kwande', 'Logo', 'Makurdi', 'Obi', 'Ogbadibo', 'Ohimini', 'Oju', 'Okpokwu', 'Otukpo', 'Tarka', 'Ukum', 'Ushongo', 'Vandeikya'],
    Borno: ['Abadam', 'Askira/Uba', 'Bama', 'Bayo', 'Biu', 'Chibok', 'Damboa', 'Dikwa', 'Gubio', 'Guzamala', 'Gwoza', 'Hawul', 'Jere', 'Kaga', 'Kala/Balge', 'Konduga', 'Kukawa', 'Kwaya Kusar', 'Mafa', 'Magumeri', 'Maiduguri', 'Marte', 'Mobbar', 'Monguno', 'Ngala', 'Nganzai', 'Shani'],
    'Cross River': ['Abi', 'Akamkpa', 'Akpabuyo', 'Bakassi', 'Bekwarra', 'Biase', 'Boki', 'Calabar Municipal', 'Calabar South', 'Etung', 'Ikom', 'Obanliku', 'Obubra', 'Obudu', 'Odukpani', 'Ogoja', 'Yakuur', 'Yala'],
    Delta: ['Aniocha North', 'Aniocha South', 'Bomadi', 'Burutu', 'Ethiope East', 'Ethiope West', 'Ika North East', 'Ika South', 'Isoko North', 'Isoko South', 'Ndokwa East', 'Ndokwa West', 'Okpe', 'Oshimili North', 'Oshimili South', 'Patani', 'Sapele', 'Udu', 'Ughelli North', 'Ughelli South', 'Ukwuani', 'Uvwie', 'Warri North', 'Warri South', 'Warri South West'],
    Ebonyi: ['Abakaliki', 'Afikpo North', 'Afikpo South', 'Ebonyi', 'Ezza North', 'Ezza South', 'Ikwo', 'Ishielu', 'Ivo', 'Izzi', 'Ohaozara', 'Ohaukwu', 'Onicha'],
    Edo: ['Akoko-Edo', 'Egor', 'Esan Central', 'Esan North-East', 'Esan South-East', 'Esan West', 'Etsako Central', 'Etsako East', 'Etsako West', 'Igueben', 'Ikpoba-Okha', 'Oredo', 'Orhionmwon', 'Ovia North-East', 'Ovia South-West', 'Owan East', 'Owan West', 'Uhunmwonde'],
    Ekiti: ['Ado Ekiti', 'Efon', 'Ekiti East', 'Ekiti South-West', 'Ekiti West', 'Emure', 'Gbonyin', 'Ido Osi', 'Ijero', 'Ikere', 'Ikole', 'Ilejemeje', 'Irepodun/Ifelodun', 'Ise/Orun', 'Moba', 'Oye'],
    Enugu: ['Aninri', 'Awgu', 'Enugu East', 'Enugu North', 'Enugu South', 'Ezeagu', 'Igbo Etiti', 'Igbo Eze North', 'Igbo Eze South', 'Isi Uzo', 'Nkanu East', 'Nkanu West', 'Nsukka', 'Oji River', 'Udenu', 'Udi', 'Uzo Uwani'],
    'FCT Abuja': ['Abaji', 'Abuja Municipal', 'Bwari', 'Gwagwalada', 'Kuje', 'Kwali'],
    Gombe: ['Akko', 'Balanga', 'Billiri', 'Dukku', 'Funakaye', 'Gombe', 'Kaltungo', 'Kwami', 'Nafada', 'Shongom', 'Yamaltu/Deba'],
    Imo: ['Aboh Mbaise', 'Ahiazu Mbaise', 'Ehime Mbano', 'Ezinihitte', 'Ideato North', 'Ideato South', 'Ihitte/Uboma', 'Ikeduru', 'Isiala Mbano', 'Isu', 'Mbaitoli', 'Ngor Okpala', 'Njaba', 'Nkwerre', 'Nwangele', 'Obowo', 'Oguta', 'Ohaji/Egbema', 'Okigwe', 'Orlu', 'Orsu', 'Oru East', 'Oru West', 'Owerri Municipal', 'Owerri North', 'Owerri West', 'Unuimo'],
    Jigawa: ['Auyo', 'Babura', 'Biriniwa', 'Birnin Kudu', 'Buji', 'Dutse', 'Gagarawa', 'Garki', 'Gumel', 'Guri', 'Gwaram', 'Gwiwa', 'Hadejia', 'Jahun', 'Kafin Hausa', 'Kaugama', 'Kazaure', 'Kiri Kasama', 'Kiyawa', 'Maigatari', 'Malam Madori', 'Miga', 'Ringim', 'Roni', 'Sule Tankarkar', 'Taura', 'Yankwashi'],
    Kaduna: ['Birnin Gwari', 'Chikun', 'Giwa', 'Igabi', 'Ikara', 'Jaba', "Jema'a", 'Kachia', 'Kaduna North', 'Kaduna South', 'Kagarko', 'Kajuru', 'Kaura', 'Kauru', 'Kubau', 'Kudan', 'Lere', 'Makarfi', 'Sabon Gari', 'Sanga', 'Soba', 'Zangon Kataf', 'Zaria'],
    Kano: ['Ajingi', 'Albasu', 'Bagwai', 'Bebeji', 'Bichi', 'Bunkure', 'Dala', 'Dambatta', 'Dawakin Kudu', 'Dawakin Tofa', 'Doguwa', 'Fagge', 'Gabasawa', 'Garko', 'Garun Mallam', 'Gaya', 'Gezawa', 'Gwale', 'Gwarzo', 'Kabo', 'Kano Municipal', 'Karaye', 'Kibiya', 'Kiru', 'Kumbotso', 'Kunchi', 'Kura', 'Madobi', 'Makoda', 'Minjibir', 'Nasarawa', 'Rano', 'Rimin Gado', 'Rogo', 'Shanono', 'Sumaila', 'Takai', 'Tarauni', 'Tofa', 'Tsanyawa', 'Tudun Wada', 'Ungogo', 'Warawa', 'Wudil'],
    Katsina: ['Bakori', 'Batagarawa', 'Batsari', 'Baure', 'Bindawa', 'Charanchi', 'Dan Musa', 'Dandume', 'Danja', 'Daura', 'Dutsi', "Dutsin-Ma", 'Faskari', 'Funtua', 'Ingawa', 'Jibia', 'Kafur', 'Kaita', 'Kankara', 'Kankia', 'Katsina', 'Kurfi', 'Kusada', "Mai'Adua", 'Malumfashi', 'Mani', 'Mashi', 'Matazu', 'Musawa', 'Rimi', 'Sabuwa', 'Safana', 'Sandamu', 'Zango'],
    Kebbi: ['Aleiro', 'Arewa Dandi', 'Argungu', 'Augie', 'Bagudo', 'Birnin Kebbi', 'Bunza', 'Dandi', 'Fakai', 'Gwandu', 'Jega', 'Kalgo', 'Koko/Besse', 'Maiyama', 'Ngaski', 'Sakaba', 'Shanga', 'Suru', 'Wasagu/Danko', 'Yauri', 'Zuru'],
    Kogi: ['Adavi', 'Ajaokuta', 'Ankpa', 'Bassa', 'Dekina', 'Ibaji', 'Idah', 'Igalamela Odolu', 'Ijumu', 'Kabba/Bunu', 'Kogi', 'Lokoja', 'Mopa Muro', 'Ofu', 'Ogori/Magongo', 'Okehi', 'Okene', 'Olamaboro', 'Omala', 'Yagba East', 'Yagba West'],
    Kwara: ['Asa', 'Baruten', 'Edu', 'Ekiti', 'Ifelodun', 'Ilorin East', 'Ilorin South', 'Ilorin West', 'Irepodun', 'Isin', 'Kaiama', 'Moro', 'Offa', 'Oke Ero', 'Oyun', 'Pategi'],
    Lagos: ['Agege', 'Ajeromi-Ifelodun', 'Alimosho', 'Amuwo-Odofin', 'Apapa', 'Badagry', 'Epe', 'Eti-Osa', 'Ibeju-Lekki', 'Ifako-Ijaiye', 'Ikeja', 'Ikorodu', 'Kosofe', 'Lagos Island', 'Lagos Mainland', 'Mushin', 'Ojo', 'Oshodi-Isolo', 'Shomolu', 'Surulere'],
    Nasarawa: ['Akwanga', 'Awe', 'Doma', 'Karu', 'Keana', 'Keffi', 'Kokona', 'Lafia', 'Nasarawa', 'Nasarawa Egon', 'Obi', 'Toto', 'Wamba'],
    Niger: ['Agaie', 'Agwara', 'Bida', 'Borgu', 'Bosso', 'Chanchaga', 'Edati', 'Gbako', 'Gurara', 'Katcha', 'Kontagora', 'Lapai', 'Lavun', 'Magama', 'Mariga', 'Mashegu', 'Mokwa', 'Moya', 'Paikoro', 'Rafi', 'Rijau', 'Shiroro', 'Suleja', 'Tafa', 'Wushishi'],
    Ogun: ['Abeokuta North', 'Abeokuta South', "Ado-Odo/Ota", 'Egbado North (Yewa North)', 'Egbado South (Yewa South)', 'Ewekoro', 'Ifo', 'Ijebu East', 'Ijebu North', 'Ijebu North East', 'Ijebu Ode', 'Ikenne', 'Imeko Afon', 'Ipokia', 'Obafemi Owode', 'Odeda', 'Odogbolu', 'Ogun Waterside', 'Remo North', 'Shagamu'],
    Ondo: ['Akoko North-East', 'Akoko North-West', 'Akoko South-East', 'Akoko South-West', 'Akure North', 'Akure South', 'Ese Odo', 'Idanre', 'Ifedore', 'Ilaje', 'Ile Oluji/Okeigbo', 'Irele', 'Odigbo', 'Okitipupa', 'Ondo East', 'Ondo West', 'Ose', 'Owo'],
    Osun: ['Atakunmosa East', 'Atakunmosa West', 'Aiyedaade', 'Aiyedire', 'Boluwaduro', 'Boripe', 'Ede North', 'Ede South', 'Egbedore', 'Ejigbo', 'Ife Central', 'Ife East', 'Ife North', 'Ife South', 'Ifedayo', 'Ifelodun', 'Ila', 'Ilesa East', 'Ilesa West', 'Irepodun', 'Irewole', 'Isokan', 'Iwo', 'Obokun', 'Odo Otin', 'Ola Oluwa', 'Olorunda', 'Oriade', 'Orolu', 'Osogbo'],
    Oyo: ['Afijio', 'Akinyele', 'Atiba', 'Atisbo', 'Egbeda', 'Ibadan North', 'Ibadan North-East', 'Ibadan North-West', 'Ibadan South-East', 'Ibadan South-West', 'Ibarapa Central', 'Ibarapa East', 'Ibarapa North', 'Ido', 'Irepo', 'Iseyin', 'Itesiwaju', 'Iwajowa', 'Kajola', 'Lagelu', 'Ogbomosho North', 'Ogbomosho South', 'Ogo Oluwa', 'Olorunsogo', 'Oluyole', 'Ona Ara', 'Orelope', 'Ori Ire', 'Oyo East', 'Oyo West', 'Saki East', 'Saki West', 'Surulere'],
    Plateau: ['Barkin Ladi', 'Bassa', 'Bokkos', 'Jos East', 'Jos North', 'Jos South', 'Kanam', 'Kanke', 'Langtang North', 'Langtang South', 'Mangu', 'Mikang', 'Pankshin', "Qua'an Pan", 'Riyom', 'Shendam', 'Wase'],
    Rivers: ['Abua/Odual', 'Ahoada East', 'Ahoada West', 'Akuku-Toru', 'Andoni', 'Asari-Toru', 'Bonny', 'Degema', 'Eleme', 'Emuoha', 'Etche', 'Gokana', 'Ikwerre', 'Khana', 'Obio/Akpor', 'Ogba/Egbema/Ndoni', 'Ogu/Bolo', 'Okrika', 'Omuma', 'Opobo/Nkoro', 'Oyigbo', 'Port Harcourt', 'Tai'],
    Sokoto: ['Binji', 'Bodinga', 'Dange Shuni', 'Gada', 'Goronyo', 'Gudu', 'Gwadabawa', 'Illela', 'Isa', 'Kebbe', 'Kware', 'Rabah', 'Sabon Birni', 'Shagari', 'Silame', 'Sokoto North', 'Sokoto South', 'Tambuwal', 'Tangaza', 'Tureta', 'Wamako', 'Wurno', 'Yabo'],
    Taraba: ['Ardo Kola', 'Bali', 'Donga', 'Gashaka', 'Gassol', 'Ibi', 'Jalingo', 'Karim Lamido', 'Kumi', 'Lau', 'Sardauna', 'Takum', 'Ussa', 'Wukari', 'Yorro', 'Zing'],
    Yobe: ['Bade', 'Bursari', 'Damaturu', 'Fika', 'Fune', 'Geidam', 'Gujba', 'Gulani', 'Jakusko', 'Karasuwa', 'Machina', 'Nangere', 'Nguru', 'Potiskum', 'Tarmuwa', 'Yunusari', 'Yusufari'],
    Zamfara: ['Anka', 'Bakura', 'Birnin Magaji/Kiyaw', 'Bukkuyum', 'Bungudu', 'Chafe', 'Gummi', 'Gusau', 'Kaura Namoda', 'Maradun', 'Maru', 'Shinkafi', 'Talata Mafara', 'Tsafe', 'Zurmi'],
  },

  'Sierra Leone': {
    'Eastern Province': ['Kailahun', 'Kenema', 'Kono'],
    'North West Province': ['Kambia', 'Karene', 'Port Loko'],
    'Northern Province': ['Bombali', 'Falaba', 'Koinadugu', 'Tonkolili'],
    'Southern Province': ['Bo', 'Bonthe', 'Moyamba', 'Pujehun'],
    'Western Area': ['Western Area Rural', 'Western Area Urban'],
  },

  Benin: {
    Alibori: ['Banikoara', 'Gogounou', 'Kandi', 'Karimama', 'Malanville', 'Segbana'],
    Atacora: ['Boukoumbé', 'Cobly', 'Kérou', 'Kouandé', 'Matéri', 'Natitingou', 'Péhunco', 'Tanguiéta', 'Toucountouna'],
    Atlantique: ['Abomey-Calavi', 'Allada', 'Kpomassè', 'Ouidah', 'Sô-Ava', 'Toffo', 'Tori-Bossito', 'Zè'],
    Borgou: ['Bembéréké', 'Kalalé', "N'Dali", 'Nikki', 'Parakou', 'Pèrèrè', 'Sinendé', 'Tchaourou'],
    Collines: ['Bantè', 'Dassa-Zoumè', 'Glazoué', 'Ouèssè', 'Savalou', 'Savè'],
    Couffo: ['Aplahoué', 'Djakotomey', 'Dogbo', 'Klouékanmè', 'Lalo', 'Toviklin'],
    Donga: ['Bassila', 'Copargo', 'Djougou', 'Ouaké'],
    Littoral: ['Cotonou'],
    Mono: ['Athiémé', 'Bopa', 'Comè', 'Grand-Popo', 'Houéyogbé', 'Lokossa'],
    Ouémé: ['Adjarra', 'Adjohoun', 'Aguégués', 'Akpro-Missérété', 'Avrankou', 'Bonou', 'Dangbo', 'Porto-Novo', 'Sèmè-Kpodji'],
    Plateau: ['Adja-Ouèrè', 'Ifangni', 'Kétou', 'Pobè', 'Sakété'],
    Zou: ['Abomey', 'Agbangnizoun', 'Bohicon', 'Covè', 'Djidja', 'Ouinhi', 'Za-Kpota', 'Zangnanado', 'Zogbodomey'],
  },

  'Burkina Faso': {
    'Boucle du Mouhoun': ['Balé', 'Banwa', 'Kossi', 'Mouhoun', 'Nayala', 'Sourou'],
    Cascades: ['Comoé', 'Léraba'],
    Centre: ['Kadiogo'],
    'Centre-Est': ['Boulgou', 'Koulpélogo', 'Kouritenga'],
    'Centre-Nord': ['Bam', 'Namentenga', 'Sanmatenga'],
    'Centre-Ouest': ['Boulkiemdé', 'Sanguié', 'Sissili', 'Ziro'],
    'Centre-Sud': ['Bazèga', 'Nahouri', 'Zoundwéogo'],
    Est: ['Gnagna', 'Gourma', 'Komondjari', 'Kompienga', 'Tapoa'],
    'Hauts-Bassins': ['Houet', 'Kénédougou', 'Tuy'],
    Nord: ['Loroum', 'Passoré', 'Yatenga', 'Zondoma'],
    'Plateau-Central': ['Ganzourgou', 'Kourwéogo', 'Oubritenga'],
    Sahel: ['Oudalan', 'Séno', 'Soum', 'Yagha'],
    'Sud-Ouest': ['Bougouriba', 'Ioba', 'Noumbiel', 'Poni'],
  },

  "Côte d'Ivoire": {
    Abidjan: ['Abidjan'],
    'Bas-Sassandra': ['Gbôklé', 'Nawa', 'San-Pédro'],
    Comoé: ['Indénié-Djuablin', 'Sud-Comoé'],
    Denguélé: ['Folon', 'Kabadougou'],
    'Gôh-Djiboua': ['Gôh', 'Lôh-Djiboua'],
    Lacs: ['Bélier', 'Iffou', "N'Zi", 'Moronou'],
    Lagunes: ['Agnéby-Tiassa', 'Grands-Ponts', 'La Mé'],
    Montagnes: ['Cavally', 'Guémon', 'Tonkpi'],
    'Sassandra-Marahoué': ['Haut-Sassandra', 'Marahoué'],
    Savanes: ['Bagoué', 'Poro', 'Tchologo'],
    'Vallée du Bandama': ['Gbêkê', 'Hambol'],
    Woroba: ['Bafing', 'Béré', 'Worodougou'],
    Yamoussoukro: ['Yamoussoukro'],
    Zanzan: ['Bounkani', 'Gontougo'],
  },

  Mali: {
    Kayes: ['Bafoulabé', 'Diéma', 'Kayes', 'Kéniéba', 'Kita', 'Nioro du Sahel', 'Yélimané'],
    Koulikoro: ['Banamba', 'Dioïla', 'Kangaba', 'Kati', 'Kolokani', 'Koulikoro', 'Nara'],
    Sikasso: ['Bougouni', 'Kadiolo', 'Kolondiéba', 'Koutiala', 'Sikasso', 'Yanfolila', 'Yorosso'],
    Ségou: ['Barouéli', 'Bla', 'Macina', 'Niono', 'San', 'Ségou', 'Tominian'],
    Mopti: ['Bandiagara', 'Bankass', 'Djenné', 'Douentza', 'Koro', 'Mopti', 'Ténenkou', 'Youwarou'],
    Tombouctou: ['Diré', 'Goundam', 'Gourma-Rharous', 'Niafunké', 'Tombouctou'],
    Gao: ['Ansongo', 'Bourem', 'Gao'],
    Kidal: ['Abeïbara', 'Kidal', 'Tessalit', 'Tin-Essako'],
    Bamako: ['Commune I', 'Commune II', 'Commune III', 'Commune IV', 'Commune V', 'Commune VI'],
  },

  Togo: {
    Maritime: ['Avé', 'Bas-Mono', 'Golfe', 'Lacs', 'Vo', 'Yoto', 'Zio'],
    Plateaux: ['Amou', 'Anié', 'Danyi', 'Est-Mono', 'Haho', 'Kloto', 'Kpélé', 'Moyen-Mono', 'Ogou', 'Wawa'],
    Centrale: ['Blitta', 'Mô', 'Sotouboua', 'Tchamba', 'Tchaoudjo'],
    Kara: ['Assoli', 'Bassar', 'Bimah', 'Dankpen', 'Doufelgou', 'Kéran', 'Kozah'],
    Savanes: ['Cinkassé', 'Kpendjal', 'Kpendjal-Ouest', 'Oti', 'Oti-Sud', 'Tandjouaré', 'Tône'],
  },

  // Ghana: intentionally not populated at district level — see note above.
};

export function getStatesForCountry(country) {
  return STATES_BY_COUNTRY[country] || [];
}

export function getLgasForState(country, state) {
  return (LGAS_BY_STATE[country] && LGAS_BY_STATE[country][state]) || [];
}
