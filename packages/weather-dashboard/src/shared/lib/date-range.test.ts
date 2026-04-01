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
});
