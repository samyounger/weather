import { WeatherDataset, WeatherFieldOption } from './types';

export const datasetFieldOptions: Record<WeatherDataset, WeatherFieldOption[]> = {
  raw: [
    { key: 'airtemperature', label: 'Temperature', color: '#dc6b3c' },
    { key: 'relativehumidity', label: 'Humidity', color: '#2e7ba2' },
    { key: 'pressure', label: 'Pressure', color: '#3d5567' },
    { key: 'windavg', label: 'Wind Avg', color: '#4f8f56' },
    { key: 'windgust', label: 'Wind Gust', color: '#1f5c3f' },
    { key: 'uv', label: 'UV', color: '#d0a62f' },
    { key: 'solarradiation', label: 'Solar Radiation', color: '#bb6e1f' },
    { key: 'rainaccumulation', label: 'Rain', color: '#4c67b0' },
  ],
  refined: [
    { key: 'airtemperature_avg', label: 'Temperature', color: '#dc6b3c' },
    { key: 'relativehumidity_avg', label: 'Humidity', color: '#2e7ba2' },
    { key: 'pressure_avg', label: 'Pressure', color: '#3d5567' },
    { key: 'windavg_avg', label: 'Wind Avg', color: '#4f8f56' },
    { key: 'windgust_max', label: 'Wind Gust', color: '#1f5c3f' },
    { key: 'uv_avg', label: 'UV', color: '#d0a62f' },
    { key: 'solarradiation_avg', label: 'Solar Radiation', color: '#bb6e1f' },
    { key: 'rainaccumulation_sum', label: 'Rain', color: '#4c67b0' },
  ],
};
