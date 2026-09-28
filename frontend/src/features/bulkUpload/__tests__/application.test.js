import { resolveNewVillages } from '../application/resolveNewVillages';
import { importHistoricalTransactions } from '../application/importHistoricalTransactions';
import { importRows } from '../application/importRows';
import { recordBulkUpload } from '../infrastructure/uploadHistory';
import { makeFakeClient } from '../testUtils';

const tables = (calls, t, m) => calls.filter((c) => c.table === t && c.ops[0][0] === m);

describe('resolveNewVillages', () => {
  const newRow = (name, extra = {}) => ({ _newVillageName: name, country: 'Nigeria', state_region: 'Abia', lga_municipality: 'Aba North', ...extra });

  test('creates ONE village for several rows naming the same new village (case-insensitive)', async () => {
    const client = makeFakeClient(({ table, ops }) => (ops[0][0] === 'insert' ? { data: { id: 'v-new' }, error: null } : { data: null, error: null }));
    const rows = [newRow('Ehere'), newRow('ehere'), newRow('EHERE')];
    await resolveNewVillages(client, rows, 'sc-1');
    expect(tables(client.calls, 'villages', 'insert')).toHaveLength(1);
    expect(rows.map((r) => r.village_id)).toEqual(['v-new', 'v-new', 'v-new']);
  });

  test('reuses a village that already exists instead of creating a duplicate', async () => {
    const client = makeFakeClient(({ ops }) => (ops[0][0] === 'select' ? { data: { id: 'v-existing' }, error: null } : { data: null, error: null }));
    const rows = [newRow('Ehere')];
    await resolveNewVillages(client, rows, 'sc-1');
    expect(tables(client.calls, 'villages', 'insert')).toHaveLength(0);
    expect(rows[0].village_id).toBe('v-existing');
  });

  test('removes the internal flag and leaves already-resolved rows alone', async () => {
    const client = makeFakeClient(({ ops }) => (ops[0][0] === 'insert' ? { data: { id: 'v' }, error: null } : { data: null, error: null }));
    const rows = [{ village_id: 'v-old' }, newRow('Ehere')];
    await resolveNewVillages(client, rows, 'sc-1');
    expect('_newVillageName' in rows[1]).toBe(false);
    expect(rows[0].village_id).toBe('v-old');
  });

  test('aborts (throws) if a village cannot be created, rather than importing rows with no village', async () => {
    const client = makeFakeClient(({ ops }) => (ops[0][0] === 'insert' ? { data: null, error: new Error('rls') } : { data: null, error: null }));
    let thrown = null;
    try { await resolveNewVillages(client, [newRow('Ehere')], 'sc-1'); } catch (e) { thrown = e; }
    expect(thrown.message).toBe('rls');
  });
});

describe('importHistoricalTransactions', () => {
  const run = (rows, rpc, tk = 'receiveStock') => {
    const client = makeFakeClient();
    client.rpc = async (name, args) => { client.rpcCalls.push({ name, args }); return rpc(args); };
    return importHistoricalTransactions(client, rows, { templateKey: tk, options: { standard: 'Organic', currency: 'XOF' }, validationErrorMessages: ['Row 9: bad'] }).then((r) => ({ ...r, client }));
  };

  test('counts inserted, failed and stock shortfalls, and keeps prior validation errors first', async () => {
    const rows = [{ quantity: 1 }, { quantity: 2 }, { quantity: 3 }];
    const r = await run(rows, (a) => (a.p_quantity === 2 ? { data: null, error: { message: 'nope' } } : { data: { stock_shortfall: a.p_quantity === 3 ? 4 : 0 }, error: null }));
    expect([r.inserted, r.failed, r.shortfallCount]).toEqual([2, 1, 1]);
    expect(r.errors).toEqual(['Row 9: bad', 'nope']);
  });

  test('receiveStock takes standard from the batch options, unit is always Kg, currency from options', async () => {
    const r = await run([{ standard: 'IGNORED', unit: 'Tonne', quantity: 1 }], () => ({ data: {}, error: null }));
    expect(r.client.rpcCalls[0].args).toEqual(expect.anything());
    const a = r.client.rpcCalls[0].args;
    expect([a.p_standard, a.p_unit, a.p_currency]).toEqual(['Organic', 'Kg', 'XOF']);
  });

  test('the generic transactions template keeps its own per-row standard and unit', async () => {
    const r = await run([{ standard: 'Sustainable', unit: 'Tonne', quantity: 1 }], () => ({ data: {}, error: null }), 'transactions');
    const a = r.client.rpcCalls[0].args;
    expect([a.p_standard, a.p_unit]).toEqual(['Sustainable', 'Tonne']);
  });
});

describe('importRows', () => {
  const template = { table: 'beekeepers' };
  const okBatch = ({ ops }) => (ops[0][0] === 'insert' ? { error: null, count: ops[0][1][0].length ?? 1 } : { data: [], error: null });

  test('inserts new rows in one batch and strips the match-only traceability_code', async () => {
    const client = makeFakeClient(okBatch);
    const r = await importRows(client, { template, validRows: [{ full_name: 'A', traceability_code: 'x' }], supplyChainId: 'sc', validationErrorMessages: [] });
    expect(r).toEqual({ inserted: 1, updated: 0, failed: 0, errors: [] });
    const inserted = tables(client.calls, 'beekeepers', 'insert')[0].ops[0][1][0];
    expect(inserted).toEqual([{ full_name: 'A' }]);
  });

  test('one bad row does not lose the good ones: batch is retried row-by-row and the failure is named', async () => {
    const client = makeFakeClient(({ ops }) => {
      if (ops[0][0] !== 'insert') return { data: [], error: null };
      const p = ops[0][1][0];
      const arr = Array.isArray(p) ? p : [p];
      return arr.some((x) => x.full_name === 'BAD') ? { error: { message: 'bad row' } } : { error: null, count: arr.length };
    });
    const rows = [{ full_name: 'G1' }, { full_name: 'BAD' }, { full_name: 'G2' }];
    const r = await importRows(client, { template, validRows: rows, supplyChainId: 'sc', validationErrorMessages: [] });
    expect([r.inserted, r.failed]).toEqual([2, 1]);
    expect(r.errors).toEqual(['BAD: bad row']);
  });

  test('a beekeeper already present (matched by traceability code) is UPDATED, not duplicated', async () => {
    const client = makeFakeClient(({ ops }) => {
      if (ops[0][0] === 'select') return { data: [{ id: 'bk-1', full_name: 'Old', village_id: 'v', traceability_code: 'KKWA-NG-000001' }], error: null };
      return { error: null, count: 1 };
    });
    const rows = [{ full_name: 'Renamed', village_id: 'v', traceability_code: 'kkwa-ng-000001' }];
    const r = await importRows(client, { template, validRows: rows, supplyChainId: 'sc', validationErrorMessages: [] });
    expect([r.inserted, r.updated]).toEqual([0, 1]);
    const update = tables(client.calls, 'beekeepers', 'update')[0];
    expect(update.ops[0][1][0]).toEqual({ full_name: 'Renamed', village_id: 'v' });
  });

  test('carries earlier validation errors forward and reports update failures against the row', async () => {
    const client = makeFakeClient(({ ops }) => {
      if (ops[0][0] === 'select') return { data: [{ id: 'bk-1', full_name: 'X', village_id: 'v', traceability_code: 'C1' }], error: null };
      return { error: { message: 'denied' } };
    });
    const r = await importRows(client, { template, validRows: [{ full_name: 'X', village_id: 'v', traceability_code: 'C1' }], supplyChainId: 'sc', validationErrorMessages: ['Row 2: earlier'] });
    expect(r.failed).toBe(1);
    expect(r.errors).toEqual(['Row 2: earlier', 'X: denied']);
  });
});

describe('recordBulkUpload', () => {
  test('writes the history row with the canonical payload shape and extras', async () => {
    const client = makeFakeClient();
    const ok = await recordBulkUpload(client, { supplyChainId: 'sc', uploadType: 'Connections', fileName: 'f.xlsx', status: 'Completed', errorDetail: null, extra: { new_beekeepers: 2 } });
    expect(ok).toBe(true);
    expect(client.calls[0].table).toBe('bulk_uploads');
    expect(client.calls[0].ops[0][1][0]).toEqual({
      supply_chain_id: 'sc', upload_type: 'Connections', file_name: 'f.xlsx', status: 'Completed', progress: 100, error_detail: null, new_beekeepers: 2,
    });
  });

  test('a logging failure is swallowed and reported as false -- it must never block the import result', async () => {
    const client = makeFakeClient(() => Promise.reject(new Error('log down')));
    const original = console.error;
    console.error = () => {}; // the failure is logged by design; keep test output clean
    try {
      const ok = await recordBulkUpload(client, { supplyChainId: 'sc', uploadType: 'Transactions', fileName: 'f', status: 'Failed', errorDetail: 'x' });
      expect(ok).toBe(false);
    } finally {
      console.error = original;
    }
  });
});
