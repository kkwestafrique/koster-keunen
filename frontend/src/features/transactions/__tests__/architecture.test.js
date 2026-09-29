import fs from 'fs';
import path from 'path';

// Same dependency rule as the bulk-upload feature module: domain stays pure, and
// pages/components only ever use the public barrel.
const ROOT = path.join(process.cwd(), 'src', 'features', 'transactions');

const importsOf = (file) =>
  [...fs.readFileSync(file, 'utf8').matchAll(/^\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
const filesIn = (dir) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.js')).map((f) => path.join(ROOT, dir, f));

describe('transactions feature layering', () => {
  const FORBIDDEN_IN_DOMAIN = [/hooks\//, /supabase/i, /^react$/, /@tanstack/, /contexts\//];

  test.each(filesIn('domain').map((f) => [path.basename(f), f]))('domain/%s stays pure (no I/O, hooks or framework imports)', (_name, file) => {
    const bad = importsOf(file).filter((spec) => FORBIDDEN_IN_DOMAIN.some((re) => re.test(spec)));
    expect(bad).toEqual([]);
  });

  test('pages and components only use the public barrel, never the internal layers', () => {
    const offenders = [];
    const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).forEach((e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return walk(p);
      if (!/\.(js|jsx)$/.test(e.name) || p.includes(`${path.sep}features${path.sep}transactions${path.sep}`)) return;
      importsOf(p).forEach((spec) => { if (/features\/transactions\/(domain|hooks)/.test(spec)) offenders.push(`${p} -> ${spec}`); });
    });
    walk(path.join(process.cwd(), 'src'));
    expect(offenders).toEqual([]);
  });
});
