import {
  aggregationLabel,
  buildChartSummaryRows,
  buildDashboardStatus,
  buildYAxisLabel,
  initialDashboardQueryState,
  resolveDashboardRange,
} from './dashboard-series';

describe('dashboard-series helpers', () => {
  it('builds the default query state', () => {
    expect(initialDashboardQueryState.dataset).toBe('series');
    expect(initialDashboardQueryState.fields).toEqual(['airtemperature_avg', 'relativehumidity_avg']);
  });

  it('resolves preset ranges', () => {
    const subject = resolveDashboardRange({
      ...initialDashboardQueryState,
      preset: '1y',
    });

    expect(subject.from).toBeInstanceOf(Date);
    expect(subject.to).toBeInstanceOf(Date);
    expect(subject.from.getTime()).toBeLessThan(subject.to.getTime());
  });

  it('resolves custom ranges', () => {
    const subject = resolveDashboardRange({
      ...initialDashboardQueryState,
      preset: 'custom',
      customFrom: '2026-01-01T00:00',
      customTo: '2026-01-02T00:00',
    });

    expect(subject.from.toISOString()).toContain('2026-01-01T00:00');
    expect(subject.to.toISOString()).toContain('2026-01-02T00:00');
  });

  it('builds the dashboard status message', () => {
    expect(buildDashboardStatus(120, 'monthly')).toBe('Showing 120 points using monthly resolution');
    expect(aggregationLabel.daily).toBe('Daily');
  });

  it('builds a single-series y axis label', () => {
    expect(buildYAxisLabel([{
      key: 'airtemperature_avg',
      label: 'Temperature',
      color: '#123456',
      unitLabel: 'degrees centigrade',
    }])).toBe('Temperature (degrees centigrade)');
  });

  it('falls back to a generic y axis label for multiple series', () => {
    expect(buildYAxisLabel([
      {
        key: 'airtemperature_avg',
        label: 'Temperature',
        color: '#123456',
        unitLabel: 'degrees centigrade',
      },
      {
        key: 'relativehumidity_avg',
        label: 'Humidity',
        color: '#abcdef',
        unitLabel: 'percent',
      },
    ])).toBe('Selected measurements');
  });

  it('builds summary rows for populated series data', () => {
    const subject = buildChartSummaryRows([
      { airtemperature_avg: 10, relativehumidity_avg: 50 },
      { airtemperature_avg: 16, relativehumidity_avg: 70 },
    ], [
      {
        key: 'airtemperature_avg',
        label: 'Temperature',
        color: '#123456',
        unitLabel: 'degrees centigrade',
      },
    ]);

    expect(subject).toEqual([{
      key: 'airtemperature_avg',
      label: 'Temperature',
      high: '16.0 degrees centigrade',
      low: '10.0 degrees centigrade',
      average: '13.0 degrees centigrade',
    }]);
  });

  it('returns N/A summary rows when no numeric values are present', () => {
    const subject = buildChartSummaryRows([
      { airtemperature_avg: null },
    ], [
      {
        key: 'airtemperature_avg',
        label: 'Temperature',
        color: '#123456',
        unitLabel: 'degrees centigrade',
      },
    ]);

    expect(subject).toEqual([{
      key: 'airtemperature_avg',
      label: 'Temperature',
      high: 'N/A',
      low: 'N/A',
      average: 'N/A',
    }]);
  });
});
