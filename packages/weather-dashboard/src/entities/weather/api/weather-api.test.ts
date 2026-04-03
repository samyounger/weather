import { fetchWeatherSeries, WeatherApiError } from './weather-api';

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
      status: 200,
      json: async () => ({
        aggregationLevel: 'daily',
        data: [
          ['2026-03-01T00:00:00Z', '17.2'],
        ],
      }),
    });

    const response = await fetchWeatherSeries(runtimeConfig, session, {
      dataset: 'series',
      fields: ['airtemperature_avg'],
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-02T00:00:00Z'),
      limit: 100,
    });

    expect(response.rows).toEqual([
      { period_start: '2026-03-01T00:00:00Z', airtemperature_avg: 17.2 },
    ]);
    expect(response.aggregationLevel).toBe('daily');
    expect((global.fetch as jest.Mock).mock.calls[0][1].headers.Authorization).toBe('Bearer id-token');
  });

  it('does not prepend period_start when it is already requested', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      json: async () => ({
        aggregationLevel: 'daily',
        data: [
          ['2026-03-01T00:00:00Z', '17.2'],
        ],
      }),
    });

    await fetchWeatherSeries(runtimeConfig, session, {
      dataset: 'series',
      fields: ['period_start', 'airtemperature_avg'],
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-02T00:00:00Z'),
      limit: 100,
    });

    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain('fields=period_start%2Cairtemperature_avg');
  });

  it('preserves nulls and raw numeric values in the mapped rows', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 200,
      json: async () => ({
        data: [
          ['2026-03-01T00:00:00Z', null, 11],
        ],
      }),
    });

    const response = await fetchWeatherSeries(runtimeConfig, session, {
      dataset: 'series',
      fields: ['airtemperature_avg', 'sample_count'],
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-02T00:00:00Z'),
      limit: 100,
    });

    expect(response.rows).toEqual([
      { period_start: '2026-03-01T00:00:00Z', airtemperature_avg: null, sample_count: 11 },
    ]);
    expect(response.aggregationLevel).toBe('15m');
  });

  it('polls pending async queries until they complete', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        status: 202,
        json: async () => ({
          status: 'PENDING',
          requestKey: 'request-1',
          aggregationLevel: 'monthly',
          pollAfterMs: 0,
          pollUrl: 'https://example.execute-api.eu-west-2.amazonaws.com/series?mode=async&requestKey=request-1',
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          status: 'SUCCEEDED',
          aggregationLevel: 'monthly',
          requestKey: 'request-1',
          data: [
            ['2026-03-01T00:00:00Z', '12.4'],
          ],
        }),
      });

    const response = await fetchWeatherSeries(runtimeConfig, session, {
      dataset: 'series',
      fields: ['airtemperature_avg'],
      from: new Date('2020-03-01T00:00:00Z'),
      to: new Date('2026-03-01T00:00:00Z'),
      limit: 100,
    });

    expect(response.aggregationLevel).toBe('monthly');
    expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('mode=async&requestKey=request-1');
  });

  it('throws a useful error when the API fails', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 500,
      json: async () => ({ error: 'Unauthorized' }),
    });

    await expect(fetchWeatherSeries(runtimeConfig, session, {
      dataset: 'series',
      fields: ['airtemperature_avg'],
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-01T01:00:00Z'),
      limit: 100,
    })).rejects.toThrow('Unauthorized');
  });

  it('exposes the resume link on timeout errors', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({
      status: 500,
      json: async () => ({
        error: 'The long-range query failed',
        pollUrl: '/series?mode=async&requestKey=request-1',
      }),
    });

    await expect(fetchWeatherSeries(runtimeConfig, session, {
      dataset: 'series',
      fields: ['airtemperature_avg'],
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-01T01:00:00Z'),
      limit: 100,
    })).rejects.toEqual(expect.objectContaining<Partial<WeatherApiError>>({
      message: 'The long-range query failed',
      resumeUrl: '/series?mode=async&requestKey=request-1',
    }));
  });

  it('uses a generated poll url when the pending response does not provide one', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        status: 202,
        json: async () => ({
          status: 'PENDING',
          requestKey: 'request-1',
          pollAfterMs: 0,
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          aggregationLevel: 'daily',
          data: [
            ['2026-03-01T00:00:00Z', '17.2'],
          ],
        }),
      });

    await fetchWeatherSeries(runtimeConfig, session, {
      dataset: 'series',
      fields: ['airtemperature_avg'],
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-02T00:00:00Z'),
      limit: 100,
    });

    expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain('/series?mode=async&requestKey=request-1');
  });

  it('uses the default poll interval when pollAfterMs is omitted', async () => {
    jest.useFakeTimers();

    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({
        status: 202,
        json: async () => ({
          status: 'PENDING',
          requestKey: 'request-1',
          pollUrl: 'https://example.execute-api.eu-west-2.amazonaws.com/series?mode=async&requestKey=request-1',
        }),
      })
      .mockResolvedValueOnce({
        status: 200,
        json: async () => ({
          aggregationLevel: 'daily',
          data: [
            ['2026-03-01T00:00:00Z', '17.2'],
          ],
        }),
      });

    const promise = fetchWeatherSeries(runtimeConfig, session, {
      dataset: 'series',
      fields: ['airtemperature_avg'],
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-02T00:00:00Z'),
      limit: 100,
    });

    await jest.advanceTimersByTimeAsync(1000);
    await promise;
    jest.useRealTimers();

    expect((global.fetch as jest.Mock).mock.calls).toHaveLength(2);
  });

  it('throws the polling timeout error when a pending response crosses the one minute limit', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(60_000);

    (global.fetch as jest.Mock).mockResolvedValue({
      status: 202,
      json: async () => ({
        status: 'PENDING',
        requestKey: 'request-1',
        pollAfterMs: 0,
        pollUrl: '/series?mode=async&requestKey=request-1',
      }),
    });

    await expect(fetchWeatherSeries(runtimeConfig, session, {
      dataset: 'series',
      fields: ['airtemperature_avg'],
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-02T00:00:00Z'),
      limit: 100,
    })).rejects.toEqual(expect.objectContaining<Partial<WeatherApiError>>({
      message: 'The query is still running after one minute. Retry shortly or reopen the saved result link when it is ready.',
      resumeUrl: '/series?mode=async&requestKey=request-1',
    }));

    nowSpy.mockRestore();
  });

  it('throws the outer timeout error when the polling window is already exhausted', async () => {
    const nowSpy = jest.spyOn(Date, 'now');
    nowSpy
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(60_001);

    await expect(fetchWeatherSeries(runtimeConfig, session, {
      dataset: 'series',
      fields: ['airtemperature_avg'],
      from: new Date('2026-03-01T00:00:00Z'),
      to: new Date('2026-03-02T00:00:00Z'),
      limit: 100,
    })).rejects.toEqual(expect.objectContaining<Partial<WeatherApiError>>({
      message: 'The query is still running after one minute. Retry shortly or reopen the saved result link when it is ready.',
    }));

    expect(global.fetch).not.toHaveBeenCalled();
    nowSpy.mockRestore();
  });

  it('returns local mock weather data when mock mode is enabled', async () => {
    const response = await fetchWeatherSeries({
      ...runtimeConfig,
      mockMode: true,
    }, session, {
      dataset: 'series',
      fields: ['airtemperature_avg', 'relativehumidity_avg'],
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
