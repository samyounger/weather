import { RuntimeConfig } from '../../../shared/config/runtime-config';
import { mockFetchWeatherSeries } from '../../../shared/mocks/mock-dashboard-data';
import { AuthTokens } from '../../session/model/session';
import { WeatherQueryParams, WeatherRow, WeatherSeriesResponse } from '../model/types';

const endpointForDataset = (dataset: WeatherQueryParams['dataset']) => dataset === 'raw' ? 'observations' : 'refined';

const parseValue = (value: unknown) => {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'number') {
    return value;
  }

  const numericValue = Number(value);
  if (!Number.isNaN(numericValue) && String(value).trim() !== '') {
    return numericValue;
  }

  return String(value);
};

export const fetchWeatherSeries = async (
  config: RuntimeConfig,
  session: AuthTokens,
  params: WeatherQueryParams,
): Promise<WeatherSeriesResponse> => {
  if (config.mockMode) {
    return mockFetchWeatherSeries(params);
  }

  const query = new URLSearchParams({
    from: params.from.toISOString(),
    to: params.to.toISOString(),
    fields: params.fields.join(','),
    limit: String(params.limit),
  });

  const response = await fetch(`${config.apiBaseUrl}/${endpointForDataset(params.dataset)}?${query.toString()}`, {
    headers: {
      Authorization: `Bearer ${session.idToken}`,
    },
  });

  const payload = await response.json() as { data?: unknown[][]; error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? 'Weather API request failed');
  }

  const rows = (payload.data ?? []).map((row) => Object.fromEntries(
    params.fields.map((field, index) => [field, parseValue(row[index])]),
  )) as WeatherRow[];

  return {
    dataset: params.dataset,
    fields: params.fields,
    rows,
  };
};
