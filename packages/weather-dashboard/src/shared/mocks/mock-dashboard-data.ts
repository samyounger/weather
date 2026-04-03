import { AuthTokens, AuthUserCredentials, ConfirmSignUpInput, SignUpInput } from '../../entities/session/model/session';
import { WeatherQueryParams, WeatherRow, WeatherSeriesResponse } from '../../entities/weather/model/types';

const toIso = (value: number) => new Date(value).toISOString();

const createMockTokens = (email: string, refreshToken = 'local-refresh-token'): AuthTokens => ({
  accessToken: `mock-access-token:${email}`,
  idToken: `mock-id-token:${email}`,
  refreshToken,
  expiresAt: Date.now() + 60 * 60 * 1000,
  email,
});

const round = (value: number) => Math.round(value * 100) / 100;
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fieldValue = (field: string, index: number) => {
  switch (field) {
    case 'airtemperature':
    case 'airtemperature_avg':
      return round(14 + Math.sin(index / 3) * 4 + index * 0.04);
    case 'relativehumidity':
    case 'relativehumidity_avg':
      return round(66 + Math.cos(index / 4) * 12);
    case 'pressure':
    case 'pressure_avg':
      return round(1008 + Math.sin(index / 5) * 5);
    case 'windavg':
    case 'windavg_avg':
      return round(4 + Math.abs(Math.sin(index / 2.5)) * 6);
    case 'windgust':
    case 'windgust_max':
      return round(7 + Math.abs(Math.cos(index / 2.2)) * 10);
    case 'uv':
    case 'uv_avg':
      return round(Math.max(0, Math.sin((index - 6) / 3)) * 8);
    case 'solarradiation':
    case 'solarradiation_avg':
      return round(Math.max(0, Math.sin((index - 6) / 3)) * 780);
    case 'rainaccumulation':
      return round(index % 18 === 0 ? 0.6 : 0);
    case 'rainaccumulation_sum':
      return round(index % 18 === 0 ? 1.4 : 0);
    default:
      return round(index + 1);
  }
};

const buildRows = (params: WeatherQueryParams): WeatherRow[] => {
  const totalRangeMs = Math.max(params.to.getTime() - params.from.getTime(), 1);
  const requestedCount = totalRangeMs > 548 * 24 * 60 * 60 * 1000
    ? 120
    : totalRangeMs > 7 * 24 * 60 * 60 * 1000
      ? 180
      : 56;
  const rowCount = Math.max(2, Math.min(params.limit, requestedCount));
  const intervalMs = Math.max(
    Math.floor(totalRangeMs / (rowCount - 1)),
    totalRangeMs > 548 * 24 * 60 * 60 * 1000
      ? 28 * 24 * 60 * 60 * 1000
      : totalRangeMs > 7 * 24 * 60 * 60 * 1000
        ? 24 * 60 * 60 * 1000
        : 15 * 60 * 1000,
  );

  return Array.from({ length: rowCount }, (_, index) => {
    const timestamp = params.from.getTime() + intervalMs * index;
    const row = Object.fromEntries(params.fields.map((field) => {
      if (field === 'period_start') {
        return [field, toIso(timestamp)];
      }

      return [field, fieldValue(field, index)];
    }));

    return row as WeatherRow;
  });
};

export const mockSignIn = async (credentials: AuthUserCredentials) => {
  if (!credentials.email.trim() || !credentials.password.trim()) {
    throw new Error('Enter an email and password to start local mock mode');
  }

  return createMockTokens(credentials.email.trim());
};

export const mockRefreshTokens = async (refreshToken: string) => (
  createMockTokens('local-user@weather.test', refreshToken || 'local-refresh-token')
);

export const mockSignUp = async (input: SignUpInput) => {
  if (!input.email.trim() || !input.password.trim()) {
    throw new Error('Enter an email and password to create a mock account');
  }
};

export const mockConfirmSignUp = async (input: ConfirmSignUpInput) => {
  if (!input.confirmationCode.trim()) {
    throw new Error('Enter a confirmation code to complete mock registration');
  }
};

export const mockFetchWeatherSeries = async (params: WeatherQueryParams): Promise<WeatherSeriesResponse> => {
  await delay(1500);

  return {
    dataset: params.dataset,
    fields: params.fields,
    rows: buildRows(params),
    aggregationLevel:
      (params.to.getTime() - params.from.getTime()) > 548 * 24 * 60 * 60 * 1000
        ? 'monthly'
        : (params.to.getTime() - params.from.getTime()) > 7 * 24 * 60 * 60 * 1000
          ? 'daily'
          : '15m',
  };
};
