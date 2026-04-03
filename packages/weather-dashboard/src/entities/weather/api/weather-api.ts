import { RuntimeConfig } from '../../../shared/config/runtime-config';
import { mockFetchWeatherSeries } from '../../../shared/mocks/mock-dashboard-data';
import { AuthTokens } from '../../session/model/session';
import { WeatherQueryParams, WeatherRow, WeatherSeriesResponse } from '../model/types';

const MAX_POLL_MS = 60_000;
const DEFAULT_POLL_INTERVAL_MS = 1_000;

type ApiPayload = {
  data?: unknown[][];
  error?: string;
  status?: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  requestKey?: string;
  queryExecutionId?: string;
  pollAfterMs?: number;
  pollUrl?: string;
  aggregationLevel?: WeatherSeriesResponse['aggregationLevel'];
};

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

const sleep = async (ms: number) => await new Promise((resolve) => setTimeout(resolve, ms));

export class WeatherApiError extends Error {
  public constructor(message: string, public readonly resumeUrl?: string) {
    super(message);
  }
}

const mapPayloadToRows = (payload: ApiPayload, params: WeatherQueryParams) => (
  (payload.data ?? []).map((row) => Object.fromEntries(
    (params.fields.includes('period_start') ? params.fields : ['period_start', ...params.fields])
      .map((field, index) => [field, parseValue(row[index])]),
  )) as WeatherRow[]
);

const fetchJson = async (url: string, session: AuthTokens) => {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${session.idToken}`,
    },
  });
  const payload = await response.json() as ApiPayload;

  return { response, payload };
};

export const fetchWeatherSeries = async (
  config: RuntimeConfig,
  session: AuthTokens,
  params: WeatherQueryParams,
): Promise<WeatherSeriesResponse> => {
  const requestedFields = params.fields.includes('period_start') ? params.fields : ['period_start', ...params.fields];

  if (config.mockMode) {
    return mockFetchWeatherSeries({
      ...params,
      fields: requestedFields,
    });
  }

  const query = new URLSearchParams({
    from: params.from.toISOString(),
    to: params.to.toISOString(),
    fields: requestedFields.join(','),
    limit: String(params.limit),
  });

  const baseUrl = `${config.apiBaseUrl}/series`;
  const startUrl = `${baseUrl}?${query.toString()}`;
  const startedAt = Date.now();
  let activeUrl = startUrl;

  while ((Date.now() - startedAt) <= MAX_POLL_MS) {
    const { response, payload } = await fetchJson(activeUrl, session);

    if (response.status === 200) {
      return {
        dataset: 'series',
        fields: params.fields,
        rows: mapPayloadToRows(payload, params),
        aggregationLevel: payload.aggregationLevel ?? '15m',
        requestKey: payload.requestKey,
      };
    }

    if (response.status !== 202) {
      throw new WeatherApiError(payload.error ?? 'Weather API request failed', payload.pollUrl);
    }

    if ((Date.now() - startedAt) >= MAX_POLL_MS) {
      throw new WeatherApiError(
        'The query is still running after one minute. Retry shortly or reopen the saved result link when it is ready.',
        payload.pollUrl,
      );
    }

    await sleep(payload.pollAfterMs ?? DEFAULT_POLL_INTERVAL_MS);
    activeUrl = payload.pollUrl ?? `${baseUrl}?mode=async&requestKey=${payload.requestKey}`;
  }

  throw new WeatherApiError(
    'The query is still running after one minute. Retry shortly or reopen the saved result link when it is ready.',
  );
};
