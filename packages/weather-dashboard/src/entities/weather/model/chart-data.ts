import { WeatherSeriesResponse } from './types';

const toIsoString = (value: string | number | null, dataset: WeatherSeriesResponse['dataset']) => {
  if (dataset === 'raw' && typeof value === 'number') {
    return new Date(value * 1000).toISOString();
  }

  return String(value ?? '');
};

export const buildChartData = (response: WeatherSeriesResponse) => response.rows.map((row) => {
  const timestampKey = response.dataset === 'raw' ? 'datetime' : 'period_start';
  const timestampValue = row[timestampKey];
  const isoValue = toIsoString(timestampValue, response.dataset);

  return {
    ...row,
    timestampLabel: isoValue.replace('T', ' ').slice(0, 16),
  };
});
