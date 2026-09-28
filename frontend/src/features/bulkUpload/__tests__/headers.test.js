import { normalizeHeader, detectUnrecognizedColumns } from '../domain/headers';
import { ORIGINAL_ROW_INDEX_KEY } from '../domain/constants';
import { BULK_UPLOAD_TEMPLATES } from '../domain/templates';
import { buildValidRow } from '../testUtils';

describe('normalizeHeader', () => {
  test('trims, lowercases and collapses internal whitespace', () => {
    expect(normalizeHeader('  Full   NAME ')).toBe('full name');
  });
  test('tolerates null/undefined', () => {
    expect(normalizeHeader(null)).toBe('');
    expect(normalizeHeader(undefined)).toBe('');
  });
});

describe('detectUnrecognizedColumns', () => {
  const template = BULK_UPLOAD_TEMPLATES.receiveStock;
  test('returns nothing for an empty file', () => {
    expect(detectUnrecognizedColumns([], template)).toEqual([]);
  });
  test('flags columns the template does not know', () => {
    const row = { ...buildValidRow(template), 'Some Random Report Column': 'x' };
    expect(detectUnrecognizedColumns([row], template)).toEqual(['Some Random Report Column']);
  });
  test('matches real headers case-insensitively', () => {
    const row = Object.fromEntries(Object.entries(buildValidRow(template)).map(([k, v]) => [k.toUpperCase(), v]));
    expect(detectUnrecognizedColumns([row], template)).toEqual([]);
  });
  test('never reports the internal row-index marker as a user column', () => {
    const row = { ...buildValidRow(template), [ORIGINAL_ROW_INDEX_KEY]: 3 };
    expect(detectUnrecognizedColumns([row], template)).toEqual([]);
  });
});
