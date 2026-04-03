import { WeatherRangePreset } from '../../entities/weather';

const subtractYears = (date: Date, years: number) => {
  const value = new Date(date);
  value.setUTCFullYear(value.getUTCFullYear() - years);
  return value;
};

export const getPresetRange = (preset: Exclude<WeatherRangePreset, 'custom'>) => {
  const to = new Date();

  if (preset === '1y') {
    return { from: subtractYears(to, 1), to };
  }

  if (preset === '3y') {
    return { from: subtractYears(to, 3), to };
  }

  if (preset === '5y') {
    return { from: subtractYears(to, 5), to };
  }

  const hours = preset === '24h'
    ? 24
    : preset === '72h'
      ? 72
      : preset === '7d'
        ? 168
        : preset === '30d'
          ? 720
          : 2160;
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);

  return { from, to };
};

export const toDateTimeLocalValue = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  .toISOString()
  .slice(0, 16);
