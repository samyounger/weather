import { buildChartData, buildWeatherQueryParams, fetchWeatherSeries, WeatherSeriesResponse } from '../../../entities/weather';
import { AuthTokens } from '../../../entities/session/model/session';
import { RuntimeConfig } from '../../../shared/config/runtime-config';
import { buildDashboardStatus, DashboardQueryState, resolveDashboardRange } from './dashboard-series';

export const loadDashboardSeries = async (
  config: RuntimeConfig,
  session: AuthTokens,
  state: DashboardQueryState,
  fetchSeries: (
    runtimeConfig: RuntimeConfig,
    authTokens: AuthTokens,
    query: ReturnType<typeof buildWeatherQueryParams>,
  ) => Promise<WeatherSeriesResponse> = fetchWeatherSeries,
) => {
  const range = resolveDashboardRange(state);
  if (Number.isNaN(range.from.getTime()) || Number.isNaN(range.to.getTime()) || range.from >= range.to) {
    throw new Error('Choose a valid custom date range before running the query');
  }

  const query = buildWeatherQueryParams({
    dataset: state.dataset,
    fields: state.fields,
    from: range.from,
    to: range.to,
    limit: 1000,
  });

  const response = await fetchSeries(config, session, query);

  return {
    aggregationLevel: response.aggregationLevel,
    chartRows: buildChartData(response),
    status: buildDashboardStatus(response.rows.length, response.aggregationLevel),
  };
};
