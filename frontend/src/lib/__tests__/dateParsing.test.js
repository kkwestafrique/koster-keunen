import { parseBulkUploadDate } from '../dateParsing';

// Date handling in bulk uploads has now failed three separate real ways:
// no conversion at all (Postgres rejected "15-01-2026" outright), a
// format change (dashes to slashes), and Excel handing the app a raw
// date serial number instead of the text the user typed. Each case
// below is a real one, not a hypothetical.

describe('parseBulkUploadDate', () => {
  describe('text input (DD/MM/YYYY)', () => {
    test('converts a valid date to ISO', () => {
      expect(parseBulkUploadDate('15/01/2026')).toEqual({ iso: '2026-01-15' });
    });

    test('accepts single-digit day and month', () => {
      expect(parseBulkUploadDate('5/3/2026')).toEqual({ iso: '2026-03-05' });
    });

    test('tolerates surrounding whitespace', () => {
      expect(parseBulkUploadDate('  15/01/2026  ')).toEqual({ iso: '2026-01-15' });
    });

    test('day-first is really honored: 03/04/2026 is 3 April, not 4 March', () => {
      expect(parseBulkUploadDate('03/04/2026')).toEqual({ iso: '2026-04-03' });
    });

    test('rejects dashes -- explicitly not an accepted format', () => {
      expect(parseBulkUploadDate('15-01-2026').error).toMatch(/DD\/MM\/YYYY/);
    });

    test('rejects ISO input, since the template promises DD/MM/YYYY', () => {
      expect(parseBulkUploadDate('2026-01-15').error).toMatch(/DD\/MM\/YYYY/);
    });

    test('rejects an impossible date rather than silently rolling it over', () => {
      expect(parseBulkUploadDate('31/02/2026').error).toMatch(/not a real date/);
      expect(parseBulkUploadDate('15/13/2026').error).toMatch(/not a real date/);
    });

    test('accepts a real leap day and rejects a fake one', () => {
      expect(parseBulkUploadDate('29/02/2028')).toEqual({ iso: '2028-02-29' });
      expect(parseBulkUploadDate('29/02/2027').error).toMatch(/not a real date/);
    });

    test('rejects a two-digit year', () => {
      expect(parseBulkUploadDate('15/01/26').error).toMatch(/DD\/MM\/YYYY/);
    });
  });

  describe('raw Excel date serial numbers', () => {
    // Confirmed empirically: a real date-typed cell reads back as this
    // number with the app's exact sheet_to_json options.
    test('46037 is 15 January 2026', () => {
      expect(parseBulkUploadDate(46037)).toEqual({ iso: '2026-01-15' });
    });

    test('converts other real dates correctly', () => {
      expect(parseBulkUploadDate(45658)).toEqual({ iso: '2025-01-01' });
      expect(parseBulkUploadDate(46022)).toEqual({ iso: '2025-12-31' });
    });

    test('a small number typed into the wrong column becomes an error, not a nonsense 1900s date', () => {
      // 590 is a perfectly valid serial (mid-1901), which is exactly why
      // an unbounded conversion would silently accept a quantity typed
      // into the date column.
      expect(parseBulkUploadDate(590).error).toMatch(/not a valid date/);
      expect(parseBulkUploadDate(5).error).toMatch(/not a valid date/);
    });

    test('an absurdly large serial is an error too', () => {
      expect(parseBulkUploadDate(9999999).error).toMatch(/not a valid date/);
    });
  });
});
