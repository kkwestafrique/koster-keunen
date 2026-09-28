import fs from 'fs';
import path from 'path';

// Architecture fitness tests: the dependency rule of the layering, enforced in CI
// so it cannot silently rot. Dependencies point inward only:
//   hooks -> infrastructure -> domain      (domain depends on nothing outward)
const ROOT = path.join(process.cwd(), 'src', 'features', 'bulkUpload');

const importsOf = (file) =>
  [...fs.readFileSync(file, 'utf8').matchAll(/^\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
const filesIn = (dir) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.js')).map((f) => path.join(ROOT, dir, f));

describe('bulk-upload layering', () => {
  const FORBIDDEN_IN_DOMAIN = [/infrastructure/, /application/, /\.\.\/hooks/, /supabase/i, /^react$/, /^exceljs$/, /@tanstack/, /contexts\//];

  test.each(filesIn('domain').map((f) => [path.basename(f), f]))('domain/%s stays pure (no I/O, UI or framework imports)', (_name, file) => {
    const bad = importsOf(file).filter((spec) => FORBIDDEN_IN_DOMAIN.some((re) => re.test(spec)));
    expect(bad).toEqual([]);
  });

  test.each(filesIn('infrastructure').map((f) => [path.basename(f), f]))('infrastructure/%s does not depend on the React hook layer', (_name, file) => {
    const bad = importsOf(file).filter((spec) => /\.\.\/hooks/.test(spec) || spec === 'react');
    expect(bad).toEqual([]);
  });

  // The application layer receives its database client as a PARAMETER (dependency
  // inversion). It must never reach out and grab a concrete client, React, or the cache.
  test.each(filesIn('application').map((f) => [path.basename(f), f]))('application/%s takes its client by injection (no concrete client, React or hooks)', (_name, file) => {
    const bad = importsOf(file).filter((spec) => /supabase/i.test(spec) || /\.\.\/hooks/.test(spec) || spec === 'react' || /@tanstack/.test(spec));
    expect(bad).toEqual([]);
  });

  test('pages and components only use the public barrel, never the internal layers', () => {
    const offenders = [];
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return walk(p);
      if (!/\.(js|jsx)$/.test(e.name) || p.includes(`${path.sep}features${path.sep}bulkUpload${path.sep}`)) return;
      importsOf(p).forEach((spec) => { if (/features\/bulkUpload\/(domain|infrastructure|hooks)/.test(spec)) offenders.push(`${p} -> ${spec}`); });
    });
    walk(path.join(process.cwd(), 'src'));
    expect(offenders).toEqual([]);
  });
});
