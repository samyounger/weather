import { WeatherDataset, WeatherFieldOption } from './types';

export const datasetFieldOptions: Record<WeatherDataset, WeatherFieldOption[]> = {
  series: [
    { key: 'airtemperature_avg', label: 'Temperature', color: '#dc6b3c', unitLabel: 'degrees centigrade' },
    { key: 'relativehumidity_avg', label: 'Humidity', color: '#2e7ba2', unitLabel: 'percent' },
    { key: 'pressure_avg', label: 'Pressure', color: '#3d5567', unitLabel: 'millibars' },
    { key: 'windavg_avg', label: 'Wind Avg', color: '#4f8f56', unitLabel: 'metres per second' },
    { key: 'windgust_max', label: 'Wind Gust', color: '#1f5c3f', unitLabel: 'metres per second' },
    { key: 'uv_avg', label: 'UV', color: '#d0a62f', unitLabel: 'UV index' },
    { key: 'solarradiation_avg', label: 'Solar Radiation', color: '#bb6e1f', unitLabel: 'watts per square metre' },
    { key: 'rainaccumulation_sum', label: 'Rain', color: '#4c67b0', unitLabel: 'millimetres' },
  ],
};
