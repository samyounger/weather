import { WeatherQueryParams } from './types';

export const buildWeatherQueryParams = (params: WeatherQueryParams) => {
  const timestampField = params.dataset === 'raw' ? 'datetime' : 'period_start';
  const fields = [timestampField, ...params.fields];

  return {
    ...params,
    fields,
  };
};
