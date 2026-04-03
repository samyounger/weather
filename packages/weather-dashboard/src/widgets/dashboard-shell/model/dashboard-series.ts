import { WeatherAggregationLevel, WeatherFieldOption, WeatherRangePreset } from '../../../entities/weather';
import { WeatherRow } from '../../../entities/weather/model/types';
import { getPresetRange, toDateTimeLocalValue } from '../../../shared/lib/date-range';

export type DashboardQueryState = {
  dataset: 'series';
  fields: string[];
  preset: WeatherRangePreset;
  customFrom: string;
  customTo: string;
};

export type DashboardSummaryRow = {
  key: string;
  label: string;
  high: string;
  low: string;
  average: string;
};

export const initialDashboardQueryState: DashboardQueryState = {
  dataset: 'series',
  fields: ['airtemperature_avg', 'relativehumidity_avg'],
  preset: '7d',
  customFrom: toDateTimeLocalValue(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
  customTo: toDateTimeLocalValue(new Date()),
};

export const aggregationLabel: Record<WeatherAggregationLevel, string> = {
  '15m': '15 minute',
  daily: 'Daily',
  monthly: 'Monthly',
};

export const resolveDashboardRange = (state: DashboardQueryState) => {
  if (state.preset === 'custom') {
    return {
      from: new Date(state.customFrom),
      to: new Date(state.customTo),
    };
  }

  return getPresetRange(state.preset);
};

export const buildDashboardStatus = (pointCount: number, aggregationLevel: WeatherAggregationLevel) => (
  `Showing ${pointCount} points using ${aggregationLabel[aggregationLevel].toLowerCase()} resolution`
);

export const buildYAxisLabel = (selectedFieldOptions: WeatherFieldOption[]) => {
  if (selectedFieldOptions.length === 1) {
    const [field] = selectedFieldOptions;
    return `${field.label} (${field.unitLabel})`;
  }

  return 'Selected measurements';
};

export const buildChartSummaryRows = (
  chartRows: WeatherRow[],
  selectedFieldOptions: WeatherFieldOption[],
): DashboardSummaryRow[] => selectedFieldOptions.map((field) => {
  const values = chartRows
    .map((row) => row[field.key])
    .filter((value): value is number => typeof value === 'number');

  if (values.length === 0) {
    return {
      key: field.key,
      label: field.label,
      high: 'N/A',
      low: 'N/A',
      average: 'N/A',
    };
  }

  const formatValue = (value: number) => `${value.toFixed(1)} ${field.unitLabel}`;

  return {
    key: field.key,
    label: field.label,
    high: formatValue(Math.max(...values)),
    low: formatValue(Math.min(...values)),
    average: formatValue(values.reduce((sum, value) => sum + value, 0) / values.length),
  };
});
