import { buildWeatherQueryParams } from './query';

describe('buildWeatherQueryParams', () => {
  it('prepends the series timestamp field', () => {
    const query = buildWeatherQueryParams({
      dataset: 'series',
      fields: ['airtemperature_avg'],
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-01T01:00:00Z'),
      limit: 100,
    });

    expect(query.fields).toEqual(['period_start', 'airtemperature_avg']);
  });
});
