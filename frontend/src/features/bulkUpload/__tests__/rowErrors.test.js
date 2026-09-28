import { summarizeRowErrors, formatErrorDetail } from '../domain/rowErrors';

describe('summarizeRowErrors', () => {
  const rows = Array.from({ length: 8 }, (_, i) => ({ rowNumber: i + 2, errors: i % 2 === 0 ? [`first ${i}`, 'second'] : [] }));
  test('reports only invalid rows, using their real row number and first error', () => {
    expect(summarizeRowErrors(rows)).toEqual(['Row 2: first 0', 'Row 4: first 2', 'Row 6: first 4', 'Row 8: first 6']);
  });
  test('is capped (default 5) because error_detail is a summary, not a log', () => {
    const many = Array.from({ length: 9 }, (_, i) => ({ rowNumber: i + 2, errors: ['bad'] }));
    expect(summarizeRowErrors(many)).toHaveLength(5);
    expect(summarizeRowErrors(many, 2)).toHaveLength(2);
  });
});

describe('formatErrorDetail', () => {
  test('is null when there is nothing to report', () => {
    expect(formatErrorDetail([])).toBeNull();
  });
  test('joins with " | " and caps at 5', () => {
    expect(formatErrorDetail(['a', 'b'])).toBe('a | b');
    expect(formatErrorDetail(['1', '2', '3', '4', '5', '6', '7'])).toBe('1 | 2 | 3 | 4 | 5');
  });
});
