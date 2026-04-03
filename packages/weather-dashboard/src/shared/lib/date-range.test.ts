import { getPresetRange } from './date-range';

describe('getPresetRange', () => {
  it('returns a 24 hour range', () => {
    const range = getPresetRange('24h');

    expect(range.to.getTime() - range.from.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('returns a 7 day range', () => {
    const range = getPresetRange('7d');

    expect(range.to.getTime() - range.from.getTime()).toBe(168 * 60 * 60 * 1000);
  });

  it('returns a 72 hour range', () => {
    const range = getPresetRange('72h');

    expect(range.to.getTime() - range.from.getTime()).toBe(72 * 60 * 60 * 1000);
  });

  it('returns a 1 year range', () => {
    const range = getPresetRange('1y');

    expect(range.to.getUTCFullYear() - range.from.getUTCFullYear()).toBe(1);
  });

  it('returns a 3 year range', () => {
    const range = getPresetRange('3y');

    expect(range.to.getUTCFullYear() - range.from.getUTCFullYear()).toBe(3);
  });

  it('returns a 5 year range', () => {
    const range = getPresetRange('5y');

    expect(range.to.getUTCFullYear() - range.from.getUTCFullYear()).toBe(5);
  });

  it('returns a 30 day range', () => {
    const range = getPresetRange('30d');

    expect(range.to.getTime() - range.from.getTime()).toBe(30 * 24 * 60 * 60 * 1000);
  });

  it('returns a 90 day range', () => {
    const range = getPresetRange('90d');

    expect(range.to.getTime() - range.from.getTime()).toBe(90 * 24 * 60 * 60 * 1000);
  });
});

describe('toDateTimeLocalValue', () => {
  it('formats a date for datetime-local inputs', async () => {
    const { toDateTimeLocalValue } = await import('./date-range');

    expect(toDateTimeLocalValue(new Date('2026-03-01T09:15:30Z'))).toHaveLength(16);
    expect(toDateTimeLocalValue(new Date('2026-03-01T09:15:30Z'))).toContain('2026-03-01');
  });
});
