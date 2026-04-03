import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import {
  datasetFieldOptions,
  WeatherAggregationLevel,
  WeatherApiError,
} from '../../../entities/weather';
import { WeatherControls } from '../../../features/weather-controls';
import { LogoutButton } from '../../../features/session-actions';
import { useAuth } from '../../../app/providers/auth-provider';
import { useRuntimeConfig } from '../../../app/providers/runtime-config-provider';
import {
  aggregationLabel,
  buildChartSummaryRows,
  buildYAxisLabel,
  DashboardQueryState,
  initialDashboardQueryState,
} from '../model/dashboard-series';
import { loadDashboardSeries } from '../model/use-dashboard-series';

export const DashboardShell = () => {
  const { session } = useAuth();
  const { config } = useRuntimeConfig();
  const [state, setState] = useState<DashboardQueryState>(initialDashboardQueryState);
  const [chartRows, setChartRows] = useState<Record<string, string | number | null>[]>([]);
  const [status, setStatus] = useState<string>('Loading latest data');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resumeUrl, setResumeUrl] = useState<string | null>(null);
  const [aggregationLevel, setAggregationLevel] = useState<WeatherAggregationLevel>('15m');

  const availableFields = useMemo(
    () => datasetFieldOptions[state.dataset],
    [state.dataset],
  );
  const selectedFieldOptions = useMemo(
    () => availableFields.filter((field) => state.fields.includes(field.key)),
    [availableFields, state.fields],
  );
  const yAxisLabel = useMemo(() => buildYAxisLabel(selectedFieldOptions), [selectedFieldOptions]);
  const chartSummaryRows = useMemo(
    () => buildChartSummaryRows(chartRows, selectedFieldOptions),
    [chartRows, selectedFieldOptions],
  );

  useEffect(() => {
    if (!config || !session || state.fields.length === 0) {
      return;
    }

    const runLoad = async () => {
      try {
        setError(null);
        setResumeUrl(null);
        setIsLoading(true);
        setStatus('Fetching weather trend data');
        const result = await loadDashboardSeries(config, session, state);
        setChartRows(result.chartRows);
        setAggregationLevel(result.aggregationLevel);
        setStatus(result.status);
      } catch (requestError) {
        if (requestError instanceof WeatherApiError) {
          setResumeUrl(requestError.resumeUrl ?? null);
        }

        setError(requestError instanceof Error ? requestError.message : 'Unable to load weather data');
      } finally {
        setIsLoading(false);
      }
    };

    void runLoad();
  }, [config, session, state]);

  return (
    <div className="page-layout">
      <section className="app-card hero">
        <div className="hero-actions">
          <div>
            <h1>Private Weather Dashboard</h1>
            <p className="muted">
              {config?.mockMode
                ? 'Viewing local mock weather data for UI iteration.'
                : 'Authenticated charts with automatic long-range aggregation.'}
            </p>
          </div>
          <LogoutButton />
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="app-card hero">
          <WeatherControls
            availableFields={availableFields}
            selectedFields={state.fields}
            selectedPreset={state.preset}
            customFrom={state.customFrom}
            customTo={state.customTo}
            onFieldsChange={(fields) => setState((currentState) => ({ ...currentState, fields }))}
            onPresetChange={(preset) => setState((currentState) => ({ ...currentState, preset }))}
            onCustomFromChange={(customFrom) => setState((currentState) => ({ ...currentState, customFrom }))}
            onCustomToChange={(customTo) => setState((currentState) => ({ ...currentState, customTo }))}
          />
        </section>

        <section className="app-card chart-card">
          <div className={`status-banner${error ? ' error-banner' : ''}`}>
            {error ?? status}
          </div>
          <div className="chart-meta">
            <span className="chart-meta-pill">Resolution: {aggregationLabel[aggregationLevel]}</span>
            {resumeUrl ? (
              <a className="chart-meta-link" href={resumeUrl}>
                Reopen pending result
              </a>
            ) : null}
          </div>
          <div className="chart-container">
            {isLoading ? (
              <div className="chart-loading" aria-live="polite" aria-label="Loading chart data">
                <div className="chart-spinner" />
                <span>Loading chart data</span>
              </div>
            ) : null}
            <ResponsiveContainer>
              <LineChart data={chartRows}>
                <CartesianGrid strokeDasharray="4 4" stroke="#cbd8df" />
                <XAxis dataKey="timestampLabel" minTickGap={24} />
                <YAxis
                  width={80}
                  label={{
                    value: yAxisLabel,
                    angle: -90,
                    position: 'insideLeft',
                    style: {
                      textAnchor: 'middle',
                      fill: '#56708d',
                    },
                  }}
                />
                <Tooltip />
                <Legend />
                {selectedFieldOptions.map((field) => (
                  <Line
                    key={field.key}
                    type="monotone"
                    dataKey={field.key}
                    stroke={field.color}
                    strokeWidth={2}
                    dot={false}
                    name={field.label}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="summary-table-wrap">
            <table className="summary-table">
              <caption>Series summary</caption>
              <thead>
                <tr>
                  <th scope="col">Metric</th>
                  <th scope="col">High</th>
                  <th scope="col">Low</th>
                  <th scope="col">Average</th>
                </tr>
              </thead>
              <tbody>
                {chartSummaryRows.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.label}</th>
                    <td>{row.high}</td>
                    <td>{row.low}</td>
                    <td>{row.average}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
};
