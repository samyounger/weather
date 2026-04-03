import { loadDashboardSeries } from './use-dashboard-series';
import { initialDashboardQueryState } from './dashboard-series';

describe('loadDashboardSeries', () => {
  const runtimeConfig = {
    apiBaseUrl: 'https://example.com',
    cognitoRegion: 'eu-west-2',
    cognitoUserPoolId: 'pool-id',
    cognitoClientId: 'client-id',
    mockMode: false,
  };
  const session = {
    accessToken: 'access-token',
    idToken: 'id-token',
    refreshToken: 'refresh-token',
    expiresAt: Date.now() + 60_000,
    email: 'user@example.com',
  };

  it('loads and formats dashboard series data', async () => {
    const subject = await loadDashboardSeries(
      runtimeConfig,
      session,
      initialDashboardQueryState,
      jest.fn().mockResolvedValue({
        dataset: 'series',
        fields: initialDashboardQueryState.fields,
        rows: [
          { period_start: '2026-01-01T00:00:00Z', airtemperature_avg: 10 },
          { period_start: '2026-01-02T00:00:00Z', airtemperature_avg: 12 },
        ],
        aggregationLevel: 'daily',
      }),
    );

    expect(subject.aggregationLevel).toBe('daily');
    expect(subject.chartRows).toHaveLength(2);
    expect(subject.status).toBe('Showing 2 points using daily resolution');
  });

  it('rejects invalid custom date ranges', async () => {
    await expect(loadDashboardSeries(
      runtimeConfig,
      session,
      {
        ...initialDashboardQueryState,
        preset: 'custom',
        customFrom: '2026-01-02T00:00',
        customTo: '2026-01-01T00:00',
      },
      jest.fn(),
    )).rejects.toThrow('Choose a valid custom date range before running the query');
  });
});
