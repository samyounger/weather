import { buildWeatherQueryParams } from './query';

describe('buildWeatherQueryParams', () => {
  it('prepends the raw timestamp field', () => {
    const query = buildWeatherQueryParams({
      dataset: 'raw',
      fields: ['airtemperature'],
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-01T01:00:00Z'),
      limit: 100,
    });

    expect(query.fields).toEqual(['datetime', 'airtemperature']);
  });

  it('prepends the refined timestamp field', () => {
    const query = buildWeatherQueryParams({
      dataset: 'refined',
      fields: ['airtemperature_avg'],
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-01T01:00:00Z'),
      limit: 100,
    });

    expect(query.fields).toEqual(['period_start', 'airtemperature_avg']);
  });
});
