import { mockConfirmSignUp, mockFetchWeatherSeries, mockRefreshTokens, mockSignIn, mockSignUp } from './mock-dashboard-data';

describe('mock-dashboard-data', () => {
  it('creates series mock weather rows for supported fields', async () => {
    const response = await mockFetchWeatherSeries({
      dataset: 'series',
      fields: [
        'period_start',
        'airtemperature_avg',
        'relativehumidity_avg',
        'pressure_avg',
        'windavg_avg',
        'windgust_max',
        'uv_avg',
        'solarradiation_avg',
        'rainaccumulation_sum',
        'custom_metric',
      ],
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-02T00:00:00Z'),
      limit: 100,
    });

    expect(response.rows[0]).toEqual(expect.objectContaining({
      period_start: expect.any(String),
      airtemperature_avg: expect.any(Number),
      relativehumidity_avg: expect.any(Number),
      pressure_avg: expect.any(Number),
      windavg_avg: expect.any(Number),
      windgust_max: expect.any(Number),
      uv_avg: expect.any(Number),
      solarradiation_avg: expect.any(Number),
      rainaccumulation_sum: expect.any(Number),
      custom_metric: expect.any(Number),
    }));
  });

  it('returns mock auth tokens and preserves refresh tokens', async () => {
    const signInTokens = await mockSignIn({
      email: 'local-user@weather.test',
      password: 'password',
    });
    const refreshedTokens = await mockRefreshTokens('refresh-token');
    const fallbackTokens = await mockRefreshTokens('');

    expect(signInTokens.email).toBe('local-user@weather.test');
    expect(refreshedTokens.refreshToken).toBe('refresh-token');
    expect(fallbackTokens.refreshToken).toBe('local-refresh-token');
  });

  it('validates local sign-in and sign-up inputs', async () => {
    await expect(mockSignIn({
      email: '',
      password: 'password',
    })).rejects.toThrow('Enter an email and password to start local mock mode');

    await expect(mockSignUp({
      email: '',
      password: '',
    })).rejects.toThrow('Enter an email and password to create a mock account');
  });

  it('validates local confirmation code input', async () => {
    await expect(mockConfirmSignUp({
      email: 'local-user@weather.test',
      confirmationCode: '',
    })).rejects.toThrow('Enter a confirmation code to complete mock registration');
  });

  it('returns daily aggregation for medium ranges', async () => {
    const response = await mockFetchWeatherSeries({
      dataset: 'series',
      fields: ['period_start', 'airtemperature_avg', 'rainaccumulation_sum'],
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2026-02-15T00:00:00Z'),
      limit: 100,
    });

    expect(response.aggregationLevel).toBe('daily');
    expect(response.rows.some((row) => row.rainaccumulation_sum === 0)).toBe(true);
  });

  it('returns monthly aggregation for very long ranges', async () => {
    const response = await mockFetchWeatherSeries({
      dataset: 'series',
      fields: ['period_start', 'airtemperature_avg'],
      from: new Date('2019-01-01T00:00:00Z'),
      to: new Date('2026-02-15T00:00:00Z'),
      limit: 200,
    });

    expect(response.aggregationLevel).toBe('monthly');
    expect(response.rows.length).toBeGreaterThan(100);
  });

  it('supports the raw field aliases used by the mock generator switch', async () => {
    const response = await mockFetchWeatherSeries({
      dataset: 'series',
      fields: [
        'period_start',
        'airtemperature',
        'relativehumidity',
        'pressure',
        'windavg',
        'windgust',
        'uv',
        'solarradiation',
        'rainaccumulation',
      ],
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-02T00:00:00Z'),
      limit: 100,
    } as never);

    expect(response.rows[0]).toEqual(expect.objectContaining({
      airtemperature: expect.any(Number),
      relativehumidity: expect.any(Number),
      pressure: expect.any(Number),
      windavg: expect.any(Number),
      windgust: expect.any(Number),
      uv: expect.any(Number),
      solarradiation: expect.any(Number),
      rainaccumulation: expect.any(Number),
    }));
    expect(response.rows.some((row) => row.rainaccumulation === 0)).toBe(true);
  });
});
