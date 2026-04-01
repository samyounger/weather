import { mockConfirmSignUp, mockFetchWeatherSeries, mockRefreshTokens, mockSignIn, mockSignUp } from './mock-dashboard-data';

describe('mock-dashboard-data', () => {
  it('creates raw mock weather rows for all supported raw fields', async () => {
    const response = await mockFetchWeatherSeries({
      dataset: 'raw',
      fields: [
        'datetime',
        'airtemperature',
        'relativehumidity',
        'pressure',
        'windavg',
        'windgust',
        'uv',
        'solarradiation',
        'rainaccumulation',
        'custom_metric',
      ],
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-02T00:00:00Z'),
      limit: 100,
    });

    expect(response.rows[0]).toEqual(expect.objectContaining({
      datetime: expect.any(Number),
      airtemperature: expect.any(Number),
      relativehumidity: expect.any(Number),
      pressure: expect.any(Number),
      windavg: expect.any(Number),
      windgust: expect.any(Number),
      uv: expect.any(Number),
      solarradiation: expect.any(Number),
      rainaccumulation: expect.any(Number),
      custom_metric: expect.any(Number),
    }));
  });

  it('creates refined mock weather rows for all supported refined fields', async () => {
    const response = await mockFetchWeatherSeries({
      dataset: 'refined',
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
      ],
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-08T00:00:00Z'),
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
    }));
  });

  it('returns mock auth tokens and preserves refresh tokens', async () => {
    const signInTokens = await mockSignIn({
      email: 'local-user@weather.test',
      password: 'password',
    });
    const refreshedTokens = await mockRefreshTokens('refresh-token');

    expect(signInTokens.email).toBe('local-user@weather.test');
    expect(refreshedTokens.refreshToken).toBe('refresh-token');
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
});
