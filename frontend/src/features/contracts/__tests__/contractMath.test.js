import { calculateAdvancePercent } from '@/lib/contractMath';

// contractMath.js already documents why this exists (three independent
// copies of this formula found drifting in a prior audit) -- it just never
// had a test of its own, despite being the designated single source of
// truth. Added while extracting the contracts feature module, since
// buildContractUpdatePayloads now depends on it directly.
describe('calculateAdvancePercent', () => {
  test('rounds to the nearest whole percent', () => {
    expect(calculateAdvancePercent(30741000, 2644411)).toBe(9);
  });
  test('0% when nothing has been advanced', () => {
    expect(calculateAdvancePercent(100, 0)).toBe(0);
  });
  test('0% when total is 0 or negative, never divides by zero', () => {
    expect(calculateAdvancePercent(0, 50)).toBe(0);
    expect(calculateAdvancePercent(-10, 50)).toBe(0);
  });
  test('coerces string inputs and treats missing values as 0', () => {
    expect(calculateAdvancePercent('200', '50')).toBe(25);
    expect(calculateAdvancePercent(200, undefined)).toBe(0);
  });
});
