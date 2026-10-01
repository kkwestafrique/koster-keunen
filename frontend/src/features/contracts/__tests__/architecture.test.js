import fs from 'fs';
import path from 'path';

const ROOT = path.join(process.cwd(), 'src', 'features', 'contracts');
const importsOf = (file) =>
  [...fs.readFileSync(file, 'utf8').matchAll(/^\s*(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]/gm)].map((m) => m[1]);
const filesIn = (dir) => fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith('.js')).map((f) => path.join(ROOT, dir, f));

describe('contracts feature layering', () => {
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
      if (!/\.(js|jsx)$/.test(e.name) || p.includes(`${path.sep}features${path.sep}contracts${path.sep}`)) return;
      importsOf(p).forEach((spec) => { if (/features\/contracts\/(domain|hooks)/.test(spec)) offenders.push(`${p} -> ${spec}`); });
    });
    walk(path.join(process.cwd(), 'src'));
    expect(offenders).toEqual([]);
  });
});
