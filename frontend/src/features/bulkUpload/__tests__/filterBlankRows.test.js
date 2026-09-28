import { filterBlankRows } from '../domain/rows';
import { ORIGINAL_ROW_INDEX_KEY } from '../domain/constants';
import { BULK_UPLOAD_TEMPLATES } from '../domain/templates';
import { buildValidRow, label } from '../testUtils';

// Real regression history: templates pre-format ~500 rows, and Excel formula
// columns (Amount / Total amount) evaluate to 0 even on an empty row. Both once
// made hundreds of phantom "invalid" rows appear from a file with 1-2 real rows.
describe('filterBlankRows', () => {
  const template = BULK_UPLOAD_TEMPLATES.receiveStock;
  const blank = () => Object.fromEntries(template.columns.map((c) => [c.label, '']));

  test('drops rows where every cell is empty, whitespace, null or undefined', () => {
    const rows = [{ ...blank(), [label(template, 'product')]: '   ' }, { a: null, b: undefined }];
    expect(filterBlankRows(rows, template)).toHaveLength(0);
  });

  test('keeps a row with at least one real value', () => {
    const rows = [{ ...blank(), [label(template, 'product')]: 'Honey' }];
    expect(filterBlankRows(rows, template)).toHaveLength(1);
  });

  test('ignores computed (formula) columns when deciding whether a row is blank', () => {
    const amount = label(template, 'amount');
    const rows = [{ ...blank(), [amount]: 0 }, { ...blank(), [amount]: '0' }];
    expect(filterBlankRows(rows, template)).toHaveLength(0);
  });

  test('still treats 0 in a NON-computed column as real data', () => {
    const rows = [{ ...blank(), [label(template, 'quantity')]: 0 }];
    expect(filterBlankRows(rows, template)).toHaveLength(1);
  });

  test('tags survivors with their true original position, across gaps', () => {
    const rows = [buildValidRow(template), blank(), blank(), buildValidRow(template)];
    const kept = filterBlankRows(rows, template);
    expect(kept.map((r) => r[ORIGINAL_ROW_INDEX_KEY])).toEqual([0, 3]);
  });

  test('does not mutate its input', () => {
    const rows = [buildValidRow(template)];
    filterBlankRows(rows, template);
    expect(ORIGINAL_ROW_INDEX_KEY in rows[0]).toBe(false);
  });

  test('works without a template (nothing is computed)', () => {
    expect(filterBlankRows([{ x: '' }, { x: 'y' }], undefined)).toHaveLength(1);
  });
});
