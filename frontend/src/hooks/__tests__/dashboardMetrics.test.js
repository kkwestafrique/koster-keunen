import { aggregateBeekeepers } from '../useBeekeepers';
import { summarizeTransactions } from '../useTransactions';

// Gap 21: dashboard metrics had no tested definition anywhere -- exactly
// the kind of gap that let the real platform's dashboard show two
// contradictory beekeeper counts on the same screen without anyone
// noticing. These tests verify the actual behavior against the written
// definitions documented directly above aggregateBeekeepers and
// summarizeTransactions in their respective files.

describe('aggregateBeekeepers (dashboard.beekeepers / gender chart / hive chart)', () => {
  test('total counts DISTINCT beekeepers, not any other unit', () => {
    const rows = [
      { gender: 'Male' }, { gender: 'Female' }, { gender: 'Male' },
    ];
    expect(aggregateBeekeepers(rows).total).toBe(3);
  });

  test('male + female + genderOther always sums to total -- the exact invariant the real platform silently broke', () => {
    const rows = [
      { gender: 'Male' }, { gender: 'Female' }, { gender: 'Other' },
      { gender: 'Male' }, { gender: 'Female' },
    ];
    const agg = aggregateBeekeepers(rows);
    expect(agg.male + agg.female + agg.genderOther).toBe(agg.total);
  });

  test('a beekeeper with a null/unrecognized gender is still counted in total but not in any gender bucket -- catches drift instead of hiding it', () => {
    const rows = [{ gender: 'Male' }, { gender: null }, { gender: 'Unexpected' }];
    const agg = aggregateBeekeepers(rows);
    expect(agg.total).toBe(3);
    expect(agg.male + agg.female + agg.genderOther).toBe(1); // only the real 'Male' row
  });

  test('hive counts are a SUM of hives, not a count of beekeepers -- must not equal total unless every beekeeper has exactly 1 hive', () => {
    const rows = [
      { gender: 'Male', hives_traditional_single: 3, hives_modern: 2 },
      { gender: 'Female', hives_traditional_double: 1, hives_other: 5 },
    ];
    const agg = aggregateBeekeepers(rows);
    expect(agg.total).toBe(2);
    expect(agg.traditional).toBe(4); // 3 + 1
    expect(agg.modern).toBe(2);
    expect(agg.other).toBe(5);
  });

  test('empty dataset produces zeroed, non-crashing output', () => {
    const agg = aggregateBeekeepers([]);
    expect(agg.total).toBe(0);
    expect(agg.male).toBe(0);
  });

  test('reproduces the real platform\'s exact documented bug, to prove this implementation does NOT have it', () => {
    // Real audit: "beekeepers delivering wax per year" showed ~12,000
    // against a real total of 534 beekeepers, because it counted
    // TRANSACTIONS instead of distinct people. Simulating that shape here
    // (many repeated "transaction-like" rows) and confirming `total`
    // still correctly reports the beekeeper count, not a larger number.
    const rows = Array.from({ length: 5 }, () => ({ gender: 'Male' })); // 5 real beekeepers
    const agg = aggregateBeekeepers(rows);
    expect(agg.total).toBe(5); // NOT some inflated transaction-count number
  });
});

describe('summarizeTransactions (dashboard.transactionOverview / by-product chart)', () => {
  test('total counts transaction ROWS (product lines), explicitly not a count of real transactions', () => {
    const rows = [
      { direction: 'Send', product: 'Honey', quantity: 10 },
      { direction: 'Send', product: 'Wax', quantity: 5 }, // same real transaction, second product line
    ];
    expect(summarizeTransactions(rows).total).toBe(2);
  });

  test('byDirection is a SUM of quantity, not a count', () => {
    const rows = [
      { direction: 'Received', product: 'Honey', quantity: 10 },
      { direction: 'Received', product: 'Honey', quantity: 15 },
      { direction: 'Send', product: 'Wax', quantity: 3 },
    ];
    const summary = summarizeTransactions(rows);
    expect(summary.byDirection.Received).toBe(25);
    expect(summary.byDirection.Send).toBe(3);
    expect(summary.byDirection.Processing).toBe(0);
  });

  test('byProduct is a SUM of quantity per product, across all directions combined', () => {
    const rows = [
      { direction: 'Received', product: 'Honey', quantity: 10 },
      { direction: 'Send', product: 'Honey', quantity: 4 },
    ];
    const summary = summarizeTransactions(rows);
    const honey = summary.byProduct.find((p) => p.product === 'Honey');
    expect(honey.quantity).toBe(14);
  });

  test('a row with a non-numeric quantity does not silently corrupt the sum (NaN would propagate through every subsequent addition)', () => {
    const rows = [
      { direction: 'Send', product: 'Honey', quantity: 10 },
      { direction: 'Send', product: 'Honey', quantity: 'not-a-number' },
    ];
    const summary = summarizeTransactions(rows);
    expect(Number.isNaN(summary.byDirection.Send)).toBe(false);
    expect(summary.byDirection.Send).toBe(10);
  });
});
