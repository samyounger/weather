import { AuthTokens } from '../../session/model/session';
import { RuntimeConfig } from '../../../shared/config/runtime-config';

export type WeatherDataset = 'raw' | 'refined';

export type WeatherFieldOption = {
  key: string;
  label: string;
  color: string;
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
};

export type FetchWeatherSeries = (
  config: RuntimeConfig,
  session: AuthTokens,
  params: WeatherQueryParams,
) => Promise<WeatherSeriesResponse>;
