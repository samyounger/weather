import { parseStormCase } from './storm-contract';
import { fetchStormCase } from '../api/storm-api';
import type { RuntimeConfig } from '../../../shared/config/runtime-config';
import type { AuthTokens } from '../../session/model/session';

const makeCase = async () => {
  const value = await fetchStormCase({ mockMode: true } as RuntimeConfig, {} as AuthTokens);
  value.event.observedMinutes = 60;
  value.event.coverage = { gust: 60 / 4320, rain: 60 / 4320, temperature: 60 / 4320, pressure: 60 / 4320 };
  const sampleAt = '2025-01-23T00:01:00.000Z';
  value.event.peakGust = { mph: 50, at: sampleAt };
  value.event.minPressure = { hpa: 980, at: sampleAt };
  value.event.temperature = { minC: 1, maxC: 4 };
  value.event.hourly = [{ at: value.event.from, gustMph: 20, rainMm: 0, pressureHpa: 980, temperatureC: 3, minutes: 60, coverageMinutes: { gust: 60, rain: 60, pressure: 60, temperature: 60 } }];
  value.event.episodes[0].qualifyingMinutes = 1;
  value.event.episodes[0].longestRunMinutes = 1;
  value.event.episodes[0].firstAt = sampleAt;
  value.event.episodes[0].lastAt = sampleAt;
  value.comparison = JSON.parse(JSON.stringify(value.event).replace(/2025/g, '2026'));
  return value;
};
const changed = (target: unknown, path: string, value: unknown) => {
  const segments = path.split('.');
  let object = target as Record<string, unknown>;
  for (const segment of segments.slice(0, -1)) {
    object = object[segment] as Record<string, unknown>;
  }
  object[segments[segments.length - 1]] = value;
};

describe('storm runtime contract', () => {
  it('accepts fully populated valid data and explicit missing measurements', async () => {
    expect(parseStormCase(await makeCase()).event.peakGust?.mph).toBe(50);
    const value = await fetchStormCase({ mockMode: true } as RuntimeConfig, {} as AuthTokens);
    expect(parseStormCase(value)).toEqual(value);
  });

  it.each([null, undefined, {}, [], 'eowyn'])('rejects malformed roots %j', (value) => {
    expect(() => parseStormCase(value)).toThrow('not recognised');
  });

  it.each([
    ['id', 'other'], ['retrievedAt', 'not-a-date'], ['source', 123],
    ['station', null], ['station.name', 2], ['station.timeZone', 'UTC'], ['station.historySince', 'bad'],
    ['event', null], ['event.from', null], ['event.to', 'bad'], ['event.expectedMinutes', -1],
    ['event.observedMinutes', '4320'], ['event.rejectedRows', NaN], ['event.conflictingMinutes', Infinity],
    ['event.coverage', null], ['event.coverage.gust', -1], ['event.coverage.rain', 2],
    ['event.coverage.pressure', null], ['event.expectedMinutes', 4000], ['event.observedMinutes', 4321], ['event.observedMinutes', 0.5], ['event.coverage.gust', 0.9], ['event.peakGust', {}], ['event.peakGust.at', 'bad'],
    ['event.peakGust.mph', '50'], ['event.minPressure', {}], ['event.rainMm', '0'],
    ['event.temperature', {}], ['event.temperature.minC', null], ['event.temperature.maxC', NaN], ['event.temperature.minC', 99],
    ['event.hourly', {}], ['event.hourly.0', null], ['event.hourly.0.at', 'bad'],
    ['event.hourly.0.minutes', '60'], ['event.hourly.0.minutes', 61], ['event.hourly.0.coverageMinutes', null], ['event.hourly.0.coverageMinutes.rain', 61], ['event.hourly.0.gustMph', '20'],
    ['event.episodes', null], ['event.episodes', []], ['event.episodes.0', null],
    ['event.episodes.0.qualifyingMinutes', '2'], ['event.episodes.0.longestRunMinutes', null],
    ['event.episodes.0.firstAt', 'bad'], ['event.episodes.0.qualifyingMinutes', -1], ['event.episodes.0.longestRunMinutes', 2], ['event.episodes.0.firstAt', '2024-01-01T00:00:00Z'], ['event.episodes.0.lastAt', '2025-01-23T00:00:00Z'], ['event.episodes.0.qualifyingMinutes', 0], ['event.episodes.0.lastAt', 'bad'],
    ['comparison', {}], ['comparisonError', 42],
  ])('rejects invalid accessed field %s', async (path, replacement) => {
    const value = await makeCase();
    changed(value, path as string, replacement);
    expect(() => parseStormCase(value)).toThrow('not recognised');
  });
});

it('rejects malformed extra episodes, duplicate thresholds and unsupported substitutions', async () => {
  const value = await makeCase();
  const valid = [...value.event.episodes];
  for (const episodes of [[null, ...valid], [valid[0], valid[0], valid[2]], [...valid.slice(0, 2), { ...valid[2], thresholdMph: 60 }]]) {
    const malformed = { ...value, event: { ...value.event, episodes } };
    expect(() => parseStormCase(malformed)).toThrow('not recognised');
  }
});
