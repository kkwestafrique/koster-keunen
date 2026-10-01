import { shapeContractDetail } from '../domain/shapeContractDetail';
import { buildContractRows } from '../domain/buildContractRows';
import { buildContractUpdatePayloads } from '../domain/buildContractUpdatePayloads';
import { aggregateFulfillment } from '../domain/aggregateFulfillment';

describe('shapeContractDetail', () => {
  test('null for an empty result set', () => {
    expect(shapeContractDetail([])).toBeNull();
  });

  test('collapses multiple product-line rows into one detail with product list and total expected quantity', () => {
    const rows = [
      { id: 1, contract_code: 'C1', product: 'Yellow wax', expected_quantity: 10, unit: 'Kg', price: 2 },
      { id: 2, contract_code: 'C1', product: 'Brown wax', expected_quantity: 5, unit: 'Kg', price: 3 },
    ];
    const d = shapeContractDetail(rows);
    expect(d.contract_code).toBe('C1');
    expect(d.products).toEqual([
      { id: 1, product: 'Yellow wax', expected_quantity: 10, unit: 'Kg', price: 2 },
      { id: 2, product: 'Brown wax', expected_quantity: 5, unit: 'Kg', price: 3 },
    ]);
    expect(d.total_quantity_expected).toBe(15);
  });

  test('a row with a missing/null expected_quantity contributes 0, not NaN', () => {
    const d = shapeContractDetail([{ id: 1, expected_quantity: null }, { id: 2, expected_quantity: 5 }]);
    expect(d.total_quantity_expected).toBe(5);
  });

  test('shares every field of the FIRST row at the top level', () => {
    const d = shapeContractDetail([{ id: 1, standard: 'Organic', expected_quantity: 1 }]);
    expect(d.standard).toBe('Organic');
  });
});

describe('buildContractRows', () => {
  test('computes total_amount from expected_quantity x price, coercing string inputs', () => {
    const [row] = buildContractRows([{ product: 'Honey', expected_quantity: '10', price: '5.5', unit: 'Kg' }], { year: 2026 });
    expect(row).toMatchObject({ year: 2026, product: 'Honey', expected_quantity: 10, price: 5.5, total_amount: 55, unit: 'Kg' });
  });

  test('total_amount is null when price is blank or absent, never 0', () => {
    expect(buildContractRows([{ product: 'Honey', expected_quantity: '10', price: '' }], {})[0].total_amount).toBeNull();
    expect(buildContractRows([{ product: 'Honey', expected_quantity: '10' }], {})[0].total_amount).toBeNull();
  });

  test('unit defaults to Kg when not supplied', () => {
    expect(buildContractRows([{ product: 'Honey', expected_quantity: '1' }], {})[0].unit).toBe('Kg');
  });

  test('shared fields apply to every row, per-row fields do not leak across rows', () => {
    const rows = buildContractRows(
      [{ product: 'A', expected_quantity: '1', price: '2' }, { product: 'B', expected_quantity: '3' }],
      { year: 2026, currency: 'NGN' }
    );
    expect(rows.map((r) => r.year)).toEqual([2026, 2026]);
    expect(rows[0].total_amount).toBe(2);
    expect(rows[1].total_amount).toBeNull();
  });
});

describe('buildContractUpdatePayloads', () => {
  test('total_amount is per-line (this row only); advance_percent is computed once across the group and shared', () => {
    const products = [
      { id: 'p1', expected_quantity: '10360', price: '1200' },
      { id: 'p2', expected_quantity: '21540', price: '850' },
    ];
    const payloads = buildContractUpdatePayloads(products, { advance_amount_paid: 2644411, updated_at: '2026-01-01' });
    // Each line's own amount, NOT the group sum -- a separate DB trigger
    // (sync_contract_group_totals) corrects this to the true group total
    // after the fact; this function matches the original application
    // code exactly, which only ever sent the per-line figure here.
    expect(payloads[0].total_amount).toBe(12432000); // 10360 * 1200
    expect(payloads[1].total_amount).toBe(18309000); // 21540 * 850
    // 2,644,411 / (12,432,000 + 18,309,000) = 8.6% -> rounds to 9
    expect(payloads[0].advance_percent).toBe(9);
    expect(payloads[1].advance_percent).toBe(payloads[0].advance_percent);
  });

  test('a garbage expected_quantity or price contributes 0, not NaN, to the group total', () => {
    const payloads = buildContractUpdatePayloads([{ id: 'p1', expected_quantity: 'abc', price: '10' }], { advance_amount_paid: 0 });
    expect(payloads[0].total_amount).toBe(0);
    expect(Number.isNaN(payloads[0].total_amount)).toBe(false);
  });

  test('attachment_url is only included in the payload when explicitly provided', () => {
    const [withUrl] = buildContractUpdatePayloads([{ id: 'p1', expected_quantity: 1, price: 1 }], { advance_amount_paid: 0, attachment_url: 'x.pdf' });
    expect(withUrl.attachment_url).toBe('x.pdf');
    const [withoutUrl] = buildContractUpdatePayloads([{ id: 'p1', expected_quantity: 1, price: 1 }], { advance_amount_paid: 0 });
    expect('attachment_url' in withoutUrl).toBe(false);
  });

  test('each payload keeps its own row id, so the caller knows which physical row to update', () => {
    const payloads = buildContractUpdatePayloads([{ id: 'row-a', expected_quantity: 1, price: 1 }, { id: 'row-b', expected_quantity: 2, price: 1 }], { advance_amount_paid: 0 });
    expect(payloads.map((p) => p.id)).toEqual(['row-a', 'row-b']);
  });
});

describe('aggregateFulfillment', () => {
  test('sums quantity grouped by contract_id', () => {
    const rows = [{ contract_id: 'c1', quantity: 10 }, { contract_id: 'c1', quantity: 5 }, { contract_id: 'c2', quantity: 3 }];
    expect(aggregateFulfillment(rows)).toEqual({ c1: 15, c2: 3 });
  });

  test('a missing/null quantity contributes 0, not NaN', () => {
    expect(aggregateFulfillment([{ contract_id: 'c1', quantity: null }])).toEqual({ c1: 0 });
  });

  test('empty/undefined input', () => {
    expect(aggregateFulfillment([])).toEqual({});
    expect(aggregateFulfillment(undefined)).toEqual({});
  });
});
