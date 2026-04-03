import { WeatherQueryParams } from './types';

export const buildWeatherQueryParams = (params: WeatherQueryParams) => {
  const fields = ['period_start', ...params.fields];

  return {
    ...params,
    fields,
  };
};
