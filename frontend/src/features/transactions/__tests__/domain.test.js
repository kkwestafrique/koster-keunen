import { summarizeTransactions } from '../domain/summarizeTransactions';
import { buildTransactionRows } from '../domain/buildTransactionRows';
import { shapeTransactionDetail } from '../domain/shapeTransactionDetail';
import { dedupeLoggers } from '../domain/dedupeLoggers';

describe('summarizeTransactions', () => {
  test('counts records (not real transactions) and sums quantity by direction and product', () => {
    const rows = [
      { direction: 'Received', product: 'Honey', quantity: '10' },
      { direction: 'Received', product: 'Honey', quantity: 5 },
      { direction: 'Send', product: 'Wax', quantity: '3' },
    ];
    const s = summarizeTransactions(rows);
    expect(s.total).toBe(3);
    expect(s.byDirection).toEqual({ Received: 15, Processing: 0, Send: 3 });
    expect(s.byProduct).toEqual([{ product: 'Honey', quantity: 15 }, { product: 'Wax', quantity: 3 }]);
  });

  test('a garbage quantity contributes 0, not NaN', () => {
    const s = summarizeTransactions([{ direction: 'Received', product: 'Honey', quantity: 'abc' }]);
    expect(s.byDirection.Received).toBe(0);
    expect(Number.isNaN(s.byDirection.Received)).toBe(false);
  });

  test('a row with no product is counted in the total and byDirection but not byProduct', () => {
    const s = summarizeTransactions([{ direction: 'Processing', quantity: 4 }]);
    expect(s.total).toBe(1);
    expect(s.byDirection.Processing).toBe(4);
    expect(s.byProduct).toEqual([]);
  });

  test('empty input', () => {
    expect(summarizeTransactions([])).toEqual({ total: 0, byDirection: { Received: 0, Processing: 0, Send: 0 }, byProduct: [] });
  });
});

describe('buildTransactionRows', () => {
  test('computes total_amount from quantity x price, coercing string inputs', () => {
    const [row] = buildTransactionRows([{ product: 'Honey', quantity: '10', price: '5.5', unit: 'Kg' }], { direction: 'Received' });
    expect(row).toMatchObject({ direction: 'Received', product: 'Honey', quantity: 10, price: 5.5, total_amount: 55, unit: 'Kg' });
  });

  test('total_amount is null when price is blank or absent, never 0', () => {
    expect(buildTransactionRows([{ product: 'Honey', quantity: '10', price: '' }], {})[0].total_amount).toBeNull();
    expect(buildTransactionRows([{ product: 'Honey', quantity: '10' }], {})[0].total_amount).toBeNull();
  });

  test('unit defaults to Kg when not supplied', () => {
    expect(buildTransactionRows([{ product: 'Honey', quantity: '1' }], {})[0].unit).toBe('Kg');
  });

  test('Processing rows: converted_product wins over product, source_quantity coerced', () => {
    const [row] = buildTransactionRows([{ product: 'Crude Honey', converted_product: 'Honey', source_product: 'Crude Honey', source_quantity: '100', quantity: '80' }], {});
    expect(row.product).toBe('Honey');
    expect(row.source_quantity).toBe(100);
  });

  test('shared fields are applied to every row, per-row fields are not leaked across rows', () => {
    const rows = buildTransactionRows(
      [{ product: 'A', quantity: '1', price: '2' }, { product: 'B', quantity: '3' }],
      { direction: 'Received', currency: 'NGN' }
    );
    expect(rows.map((r) => r.direction)).toEqual(['Received', 'Received']);
    expect(rows[1].total_amount).toBeNull();
    expect(rows[0].total_amount).toBe(2);
  });
});

describe('shapeTransactionDetail', () => {
  test('null for an empty result set (transaction not found)', () => {
    expect(shapeTransactionDetail([])).toBeNull();
  });

  test('collapses multiple product-line rows into one detail with product list and totals', () => {
    const rows = [
      { id: 1, transaction_code: 'TX1', product: 'Honey', quantity: 10, unit: 'Kg', price: 2, total_amount: 20, stocks: { batch_reference: 'B1' } },
      { id: 2, transaction_code: 'TX1', product: 'Wax', quantity: 5, unit: 'Kg', price: 3, total_amount: 15, stocks: null },
    ];
    const d = shapeTransactionDetail(rows);
    expect(d.transaction_code).toBe('TX1');
    expect(d.products).toEqual([
      { id: 1, product: 'Honey', quantity: 10, unit: 'Kg', price: 2, total_amount: 20, destination_batch: 'B1' },
      { id: 2, product: 'Wax', quantity: 5, unit: 'Kg', price: 3, total_amount: 15, destination_batch: undefined },
    ]);
    expect(d.total_quantity).toBe(15);
    expect(d.total_amount).toBe(35);
  });

  test('shares every field of the FIRST row at the top level (group-shared columns)', () => {
    const rows = [{ id: 1, status: 'Approved', quantity: 1, total_amount: 1 }];
    expect(shapeTransactionDetail(rows).status).toBe('Approved');
  });

  test('a row with a missing/null quantity or total_amount contributes 0 to the totals, not NaN', () => {
    const rows = [
      { id: 1, quantity: null, total_amount: undefined },
      { id: 2, quantity: 5, total_amount: 10 },
    ];
    const d = shapeTransactionDetail(rows);
    expect(d.total_quantity).toBe(5);
    expect(d.total_amount).toBe(10);
  });
});

describe('dedupeLoggers', () => {
  test('keeps the FIRST username seen per user id, drops rows with no linked user', () => {
    const rows = [
      { user_accounts: { id: 'u1', username: 'Alice' } },
      { user_accounts: { id: 'u1', username: 'Alice (renamed, should not appear)' } },
      { user_accounts: { id: 'u2', username: 'Bob' } },
      { user_accounts: null },
    ];
    expect(dedupeLoggers(rows)).toEqual([{ value: 'u1', label: 'Alice' }, { value: 'u2', label: 'Bob' }]);
  });

  test('empty input', () => {
    expect(dedupeLoggers([])).toEqual([]);
  });
});
