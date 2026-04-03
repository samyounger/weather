import { buildChartData } from './chart-data';

describe('buildChartData', () => {
  it('formats series timestamps from ISO strings', () => {
    const result = buildChartData({
      dataset: 'series',
      fields: ['period_start', 'airtemperature_avg'],
      rows: [{ period_start: '2026-03-01T09:15:00Z', airtemperature_avg: 14.2 }],
      aggregationLevel: 'daily',
    });

    expect(result[0].timestampLabel).toBe('2026-03-01 09:15');
  });
});
