import { fetchWeatherSeries } from './weather-api';

const runtimeConfig = {
  apiBaseUrl: 'https://example.execute-api.eu-west-2.amazonaws.com',
  cognitoRegion: 'eu-west-2',
  cognitoUserPoolId: 'eu-west-2_123',
  cognitoClientId: 'client-123',
  mockMode: false,
};

const session = {
  accessToken: 'access',
  idToken: 'id-token',
  refreshToken: 'refresh-token',
  expiresAt: Date.now() + 60000,
  email: 'user@example.com',
};

describe('weather-api', () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('maps API rows into weather objects', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          [1772323200, '17.2'],
        ],
      }),
    });

    const response = await fetchWeatherSeries(runtimeConfig, session, {
      dataset: 'raw',
      fields: ['datetime', 'airtemperature'],
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-01T01:00:00Z'),
      limit: 100,
    });

    expect(response.rows).toEqual([
      { datetime: 1772323200, airtemperature: 17.2 },
    ]);
    expect((global.fetch as jest.Mock).mock.calls[0][1].headers.Authorization).toBe('Bearer id-token');
  });

  it('preserves nulls and raw numeric values', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          ['2026-03-01T00:00:00Z', null, 11],
        ],
      }),
    });

    const response = await fetchWeatherSeries(runtimeConfig, session, {
      dataset: 'refined',
      fields: ['period_start', 'airtemperature_avg', 'sample_count'],
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-01T01:00:00Z'),
      limit: 100,
    });

    expect(response.rows).toEqual([
      { period_start: '2026-03-01T00:00:00Z', airtemperature_avg: null, sample_count: 11 },
    ]);
  });

  it('throws a useful error when the API fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Unauthorized' }),
    });

    await expect(fetchWeatherSeries(runtimeConfig, session, {
      dataset: 'refined',
      fields: ['period_start', 'airtemperature_avg'],
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-01T01:00:00Z'),
      limit: 100,
    })).rejects.toThrow('Unauthorized');
  });

  it('handles missing data arrays', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({}),
    });

    const response = await fetchWeatherSeries(runtimeConfig, session, {
      dataset: 'refined',
      fields: ['period_start', 'airtemperature_avg'],
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-01T01:00:00Z'),
      limit: 100,
    });

    expect(response.rows).toEqual([]);
  });

  it('returns local mock weather data when mock mode is enabled', async () => {
    const response = await fetchWeatherSeries({
      ...runtimeConfig,
      mockMode: true,
    }, session, {
      dataset: 'refined',
      fields: ['period_start', 'airtemperature_avg', 'relativehumidity_avg'],
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-08T00:00:00Z'),
      limit: 100,
    });

    expect(global.fetch).not.toHaveBeenCalled();
    expect(response.rows.length).toBeGreaterThan(1);
    expect(response.rows[0]).toEqual(expect.objectContaining({
      period_start: expect.any(String),
      airtemperature_avg: expect.any(Number),
      relativehumidity_avg: expect.any(Number),
    }));
  });
});
