import { summariseStorm } from './storm-observations';

const from = '2025-01-23T00:00:00.000Z';
const to = '2025-01-23T01:00:00.000Z';
const epoch = Date.parse(from) / 1000;
const row = (minute: number, gust: unknown = 20, rain: unknown = 0.1, temp: unknown = 3, pressure: unknown = 980) => {
  const values: unknown[] = Array(22).fill(0);
  values[0] = epoch + minute * 60;
  values[3] = gust; values[6] = pressure; values[7] = temp; values[12] = rain; values[17] = 1;
  return values;
};

describe('summariseStorm', () => {
  it('computes real sampled extrema, mph, interval rainfall and equal-minute averages', () => {
    const result = summariseStorm([row(1, 10, 1, 2, 970), row(2, 30, 2, 6, 990)], from, to);
    expect(result.peakGust).toEqual({ mph: 67.11, at: '2025-01-23T00:02:00.000Z' });
    expect(result.rainMm).toBe(3);
    expect(result.temperature).toEqual({ minC: 2, maxC: 6 });
    expect(result.minPressure).toEqual({ hpa: 970, at: '2025-01-23T00:01:00.000Z' });
    expect(result.coverage.gust).toBeCloseTo(2 / 60);
    expect(result.hourly[0]).toEqual({
      at: from, gustMph: 67.11, rainMm: 3, pressureHpa: 980, temperatureC: 4, minutes: 2,
      coverageMinutes: { gust: 2, rain: 2, pressure: 2, temperature: 2 },
    });
  });

  it('deduplicates identical values and discards conflicting minutes regardless of input order', () => {
    const result = summariseStorm([row(1), row(1), row(2), row(2, 30), row(2)], from, to);
    expect(result.observedMinutes).toBe(1);
    expect(result.conflictingMinutes).toBe(1);
    expect(result.rainMm).toBe(0.1);
  });

  it('excludes intervals outside the half-open reporting window, retaining its final minute', () => {
    const result = summariseStorm([row(-1), row(0), row(60), row(61)], from, to);
    expect(result.observedMinutes).toBe(1);
    expect(result.peakGust?.at).toBe(to);
    expect(result.hourly[0].minutes).toBe(1);
  });

  it('does not coerce null, strings, NaN, infinity or implausible readings into measurements', () => {
    const result = summariseStorm([
      row(1, null, null, null, null),
      row(2, '25', '', '4', '980'),
      row(3, NaN, Infinity, -110, 1300),
      row(4, -1, -1, 90, 0),
    ], from, to);
    expect(result.observedMinutes).toBe(4);
    expect(result.coverage).toEqual({ gust: 0, rain: 0, temperature: 0, pressure: 0 });
    expect(result.peakGust).toBeNull();
    expect(result.rainMm).toBeNull();
    expect(result.temperature).toBeNull();
    expect(result.minPressure).toBeNull();
    expect(result.hourly[0]).toMatchObject({ gustMph: null, rainMm: null, pressureHpa: null, temperatureC: null });
  });

  it('rejects malformed/non-minute intervals rather than calling averages real extremes', () => {
    const fiveMinute = row(4); fiveMinute[17] = 5;
    const offGrid = row(5); offGrid[0] = epoch + 301;
    const badEpoch = row(6); badEpoch[0] = Infinity;
    const stringEpoch = row(7); stringEpoch[0] = String(epoch);
    const result = summariseStorm([null, {}, [], fiveMinute, offGrid, badEpoch, stringEpoch], from, to);
    expect(result.rejectedRows).toBe(7);
    expect(result.observedMinutes).toBe(0);
  });

  it('breaks gust runs at gaps, invalid metrics and below-threshold minutes', () => {
    const result = summariseStorm([row(1), row(2), row(4), row(5, null), row(6), row(7, 1), row(8)], from, to);
    expect(result.episodes.find((e) => e.thresholdMph === 40)).toEqual({
      thresholdMph: 40, qualifyingMinutes: 5, longestRunMinutes: 2,
      firstAt: '2025-01-23T00:01:00.000Z', lastAt: '2025-01-23T00:08:00.000Z',
    });
    expect(result.episodes.find((e) => e.thresholdMph === 50)?.qualifyingMinutes).toBe(0);
  });

  it('keeps hourly gaps null, not zero or interpolated', () => {
    const result = summariseStorm([row(1)], from, '2025-01-23T03:00:00.000Z');
    expect(result.hourly).toHaveLength(3);
    expect(result.hourly[1]).toMatchObject({ gustMph: null, rainMm: null, minutes: 0 });
    expect(result.episodes[2].firstAt).toBeNull();
  });

  it('preserves observed zero rain rather than treating it as missing', () => {
    expect(summariseStorm([row(1, 0, 0, 0, 1000)], from, to).rainMm).toBe(0);
  });

  it.each([
    ['bad', to], [from, from], [to, from],
    [from, '2025-01-27T00:00:00Z'], [from, '2025-01-23T00:00:01Z'],
  ])('rejects invalid fixed windows %s → %s', (start, end) => {
    expect(() => summariseStorm([], start, end)).toThrow('Invalid fixed observation window');
  });
});

it('exposes independent hourly metric counts rather than implying every report contains rain', () => {
  const result = summariseStorm([row(1, 20, 1), row(2, null, null), row(3, 20, null)], from, to);
  expect(result.hourly[0].minutes).toBe(3);
  expect(result.hourly[0].rainMm).toBe(1);
  expect(result.hourly[0].coverageMinutes).toEqual({ gust: 2, rain: 1, pressure: 3, temperature: 3 });
});
