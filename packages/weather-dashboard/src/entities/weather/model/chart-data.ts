import { WeatherSeriesResponse } from './types';

export const buildChartData = (response: WeatherSeriesResponse) => response.rows.map((row) => {
  const timestampValue = row.period_start;
  const isoValue = String(timestampValue ?? '');

  return {
    ...row,
    timestampLabel: isoValue.replace('T', ' ').slice(0, 16),
  };
});
