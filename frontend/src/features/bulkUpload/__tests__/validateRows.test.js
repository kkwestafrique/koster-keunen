import { validateRows } from '../domain/validateRows';
import { ORIGINAL_ROW_INDEX_KEY } from '../domain/constants';
import { BULK_UPLOAD_TEMPLATES } from '../domain/templates';
import { buildValidRow, label, makeLookups } from '../testUtils';

const run = (templateKey, rows, lookups = makeLookups(), isHistorical = false) =>
  validateRows(rows, BULK_UPLOAD_TEMPLATES[templateKey], lookups, isHistorical);

describe('validateRows - receiveStock', () => {
  const t = BULK_UPLOAD_TEMPLATES.receiveStock;

  test('a fully valid row has no errors and resolves the beekeeper id', () => {
    const [r] = run('receiveStock', [buildValidRow(t)]);
    expect(r.errors).toEqual([]);
    expect(r.data.beekeeper_id).toBe('bk-1');
  });

  test('total_amount is always recalculated from quantity x price, never read from the file', () => {
    const row = { ...buildValidRow(t), [label(t, 'amount')]: 999999 };
    const [r] = run('receiveStock', [row]);
    expect(r.data.total_amount).toBe(144);
  });

  test('a missing required field is reported by its column label', () => {
    const row = { ...buildValidRow(t), [label(t, 'quantity')]: '' };
    const [r] = run('receiveStock', [row]);
    expect(r.errors).toContain(`${label(t, 'quantity')} is required`);
  });

  test('a value outside the allowed list is rejected', () => {
    const row = { ...buildValidRow(t), [label(t, 'product')]: 'Not A Product' };
    const [r] = run('receiveStock', [row]);
    expect(r.errors.some((e) => e.startsWith('Product must be one of'))).toBe(true);
  });

  test('an unknown beekeeper code is reported and does not resolve an id', () => {
    const row = { ...buildValidRow(t), [label(t, 'beekeeper_code')]: 'KKWA-XX-999999 - Nobody' };
    const [r] = run('receiveStock', [row]);
    expect(r.errors.some((e) => e.includes('not found'))).toBe(true);
    expect(r.data.beekeeper_id).toBeNull();
  });

  test('dates accept DD/MM/YYYY and Excel serial numbers, reject junk', () => {
    const d = label(t, 'transaction_date');
    expect(run('receiveStock', [{ ...buildValidRow(t), [d]: '15/01/2026' }])[0].errors).toEqual([]);
    expect(run('receiveStock', [{ ...buildValidRow(t), [d]: 46037 }])[0].errors).toEqual([]);
    expect(run('receiveStock', [{ ...buildValidRow(t), [d]: 'not a date' }])[0].errors.length).toBeGreaterThan(0);
  });

  test('header matching is case-insensitive', () => {
    const row = Object.fromEntries(Object.entries(buildValidRow(t)).map(([k, v]) => [k.toUpperCase(), v]));
    expect(run('receiveStock', [row])[0].errors).toEqual([]);
  });
});

describe('validateRows - row numbering', () => {
  const t = BULK_UPLOAD_TEMPLATES.receiveStock;
  test('defaults to array position + 2 (row 1 is the header)', () => {
    const rows = run('receiveStock', [buildValidRow(t), buildValidRow(t)]);
    expect(rows.map((r) => r.rowNumber)).toEqual([2, 3]);
  });
  test('uses the preserved original index when blank rows were filtered out', () => {
    const rows = run('receiveStock', [{ ...buildValidRow(t), [ORIGINAL_ROW_INDEX_KEY]: 7 }]);
    expect(rows[0].rowNumber).toBe(9);
  });
});

describe('validateRows - beekeepers (villages)', () => {
  const t = BULK_UPLOAD_TEMPLATES.beekeepers;
  test('an existing village resolves to its id', () => {
    const [r] = run('beekeepers', [buildValidRow(t)]);
    expect(r.errors).toEqual([]);
    expect(r.data.village_id).toBe('village-1');
  });
  test('a genuinely new village is NOT an error - it is flagged to be created at import time', () => {
    const row = { ...buildValidRow(t), [label(t, 'village_name')]: 'Ehere' };
    const [r] = run('beekeepers', [row]);
    expect(r.errors).toEqual([]);
    expect(r.data.village_id).toBeNull();
    expect(r.data._newVillageName).toBe('Ehere');
  });
  test('a one-character village name is rejected rather than silently creating a junk village', () => {
    const row = { ...buildValidRow(t), [label(t, 'village_name')]: 'E' };
    const [r] = run('beekeepers', [row]);
    expect(r.errors.some((e) => e.includes('too short'))).toBe(true);
  });
});
