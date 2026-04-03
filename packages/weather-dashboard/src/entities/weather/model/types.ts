import { AuthTokens } from '../../session/model/session';
import { RuntimeConfig } from '../../../shared/config/runtime-config';

export type WeatherDataset = 'series';
export type WeatherAggregationLevel = '15m' | 'daily' | 'monthly';
export type WeatherRangePreset = '24h' | '72h' | '7d' | '30d' | '90d' | '1y' | '3y' | '5y' | 'custom';

export type WeatherFieldOption = {
  key: string;
  label: string;
  color: string;
  unitLabel: string;
};

export type WeatherQueryParams = {
  dataset: WeatherDataset;
  fields: string[];
  from: Date;
  to: Date;
  limit: number;
};

export type WeatherRow = Record<string, string | number | null>;

export type WeatherSeriesResponse = {
  dataset: WeatherDataset;
  fields: string[];
  rows: WeatherRow[];
  aggregationLevel: WeatherAggregationLevel;
  requestKey?: string;
};

export type FetchWeatherSeries = (
  config: RuntimeConfig,
  session: AuthTokens,
  params: WeatherQueryParams,
) => Promise<WeatherSeriesResponse>;
