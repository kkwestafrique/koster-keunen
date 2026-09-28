// Test-only helpers (kept outside __tests__ so Jest doesn't treat it as a suite).
// Builds rows from each template's OWN column definitions, so tests track the
// real templates instead of hard-coding labels that would silently drift.
export function sampleValue(col) {
  if (col.allowed && col.allowed.length) return String(col.allowed[0]);
  if (col.type === 'date') return '15/01/2026';
  if (col.type === 'number') return '12';
  if (col.key === 'beekeeper_code') return 'KKWA-NG-000001 - Test';
  if (col.key === 'actor_code') return 'KKWA-NG-0001 - Test';
  if (col.key === 'village_name') return 'Testville';
  if (col.key === 'country') return 'Nigeria';
  if (col.key === 'state_region') return 'Abia';
  if (col.key === 'lga_municipality') return 'Aba North';
  return 'x';
}

export function buildValidRow(template) {
  return Object.fromEntries(template.columns.map((c) => [c.label, c.computed ? 0 : sampleValue(c)]));
}

export const label = (template, key) => template.columns.find((c) => c.key === key).label;

export function makeLookups(overrides = {}) {
  return {
    villagesByName: { 'testville|nigeria|abia|aba north': 'village-1' },
    actorsByCode: { 'kkwa-ng-0001': 'actor-1' },
    beekeepersByCode: { 'kkwa-ng-000001': 'bk-1' },
    ...overrides,
  };
}

// Minimal call-recording stand-in for a Supabase client. Every query chain is
// recorded ({ table, ops: [[method, args], ...] }) and resolved by `respond`.
// Because the application layer takes its client as a parameter, use-cases can be
// tested with this -- no network, no React, no module mocking.
export function makeFakeClient(respond = () => ({ data: null, error: null })) {
  const calls = [];
  const from = (table) => {
    const ops = [];
    const chain = new Proxy({}, {
      get(_, method) {
        if (method === 'then') {
          return (resolve, reject) => {
            calls.push({ table, ops: ops.map(([m, a]) => [m, a]) });
            Promise.resolve(respond({ table, ops })).then(resolve, reject);
          };
        }
        return (...args) => { ops.push([method, args]); return chain; };
      },
    });
    return chain;
  };
  const rpcCalls = [];
  return { calls, rpcCalls, from, rpc: async (name, args) => { rpcCalls.push({ name, args }); return { data: { stock_shortfall: 0 }, error: null }; } };
}
