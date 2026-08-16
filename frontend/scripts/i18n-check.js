#!/usr/bin/env node
// Gap #12: nothing previously enforced that EN/FR translations stayed in
// sync -- they were kept aligned entirely by hand, by convention. This
// walks both translation.json files, flattens every nested key into a
// dotted path, and fails the build (non-zero exit code) if either
// language is missing a key the other one has. Matches the blueprint
// principle directly: an incomplete translation should fail the build,
// not quietly fall back to the wrong language at runtime.

const fs = require('fs');
const path = require('path');

const EN_PATH = path.join(__dirname, '..', 'src', 'locales', 'en', 'translation.json');
const FR_PATH = path.join(__dirname, '..', 'src', 'locales', 'fr', 'translation.json');

function flatten(obj, prefix = '') {
  let keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys = keys.concat(flatten(v, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function loadKeys(filePath, label) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (err) {
    console.error(`i18n-check: could not read ${label} translation file at ${filePath}`);
    process.exit(1);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.error(`i18n-check: ${label} translation file is not valid JSON -- ${err.message}`);
    process.exit(1);
  }
  return new Set(flatten(parsed));
}

const enKeys = loadKeys(EN_PATH, 'English');
const frKeys = loadKeys(FR_PATH, 'French');

const missingInFr = [...enKeys].filter((k) => !frKeys.has(k)).sort();
const missingInEn = [...frKeys].filter((k) => !enKeys.has(k)).sort();

if (missingInFr.length === 0 && missingInEn.length === 0) {
  console.log(`i18n-check: OK -- ${enKeys.size} keys, EN and FR fully in sync.`);
  process.exit(0);
}

if (missingInFr.length > 0) {
  console.error(`\ni18n-check: ${missingInFr.length} key(s) exist in English but are MISSING from French:`);
  missingInFr.forEach((k) => console.error(`  - ${k}`));
}
if (missingInEn.length > 0) {
  console.error(`\ni18n-check: ${missingInEn.length} key(s) exist in French but are MISSING from English:`);
  missingInEn.forEach((k) => console.error(`  - ${k}`));
}
console.error('\ni18n-check: FAILED. Add the missing key(s) to the other language file before building.\n');
process.exit(1);
