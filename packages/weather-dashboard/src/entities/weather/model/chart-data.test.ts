import { buildChartData } from './chart-data';

describe('buildChartData', () => {
  it('formats raw timestamps from epoch seconds', () => {
    const result = buildChartData({
      dataset: 'raw',
      fields: ['datetime', 'airtemperature'],
      rows: [{ datetime: 1772323200, airtemperature: 17 }],
    });

    expect(result[0].timestampLabel).toBe('2026-03-01 00:00');
  });

  it('formats refined timestamps from ISO strings', () => {
    const result = buildChartData({
      dataset: 'refined',
      fields: ['period_start', 'airtemperature_avg'],
      rows: [{ period_start: '2026-03-01T09:15:00Z', airtemperature_avg: 14.2 }],
    });

    expect(result[0].timestampLabel).toBe('2026-03-01 09:15');
  });
});
