import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import {
  buildChartData,
  buildWeatherQueryParams,
  datasetFieldOptions,
  fetchWeatherSeries,
  WeatherAggregationLevel,
  WeatherApiError,
  WeatherRangePreset,
} from '../../../entities/weather';
import { WeatherControls } from '../../../features/weather-controls';
import { LogoutButton } from '../../../features/session-actions';
import { useAuth } from '../../../app/providers/auth-provider';
import { useRuntimeConfig } from '../../../app/providers/runtime-config-provider';
import { getPresetRange, toDateTimeLocalValue } from '../../../shared/lib/date-range';

type QueryState = {
  dataset: 'series';
  fields: string[];
  preset: WeatherRangePreset;
  customFrom: string;
  customTo: string;
};

const initialState: QueryState = {
  dataset: 'series',
  fields: ['airtemperature_avg', 'relativehumidity_avg'],
  preset: '7d',
  customFrom: toDateTimeLocalValue(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)),
  customTo: toDateTimeLocalValue(new Date()),
};

const aggregationLabel: Record<WeatherAggregationLevel, string> = {
  '15m': '15 minute',
  daily: 'Daily',
  monthly: 'Monthly',
};

export const DashboardShell = () => {
  const { session } = useAuth();
  const { config } = useRuntimeConfig();
  const [state, setState] = useState<QueryState>(initialState);
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
  const yAxisLabel = useMemo(() => {
    if (selectedFieldOptions.length === 1) {
      const [field] = selectedFieldOptions;
      return `${field.label} (${field.unitLabel})`;
    }

    return 'Selected measurements';
  }, [selectedFieldOptions]);
  const chartSummaryRows = useMemo(
    () => selectedFieldOptions.map((field) => {
      const values = chartRows
        .map((row) => row[field.key])
        .filter((value): value is number => typeof value === 'number');

      if (values.length === 0) {
        return {
          key: field.key,
          label: field.label,
          high: 'N/A',
          low: 'N/A',
          average: 'N/A',
        };
      }

      const formatValue = (value: number) => `${value.toFixed(1)} ${field.unitLabel}`;

      return {
        key: field.key,
        label: field.label,
        high: formatValue(Math.max(...values)),
        low: formatValue(Math.min(...values)),
        average: formatValue(values.reduce((sum, value) => sum + value, 0) / values.length),
      };
    }),
    [chartRows, selectedFieldOptions],
  );

  useEffect(() => {
    if (!config || !session || state.fields.length === 0) {
      return;
    }

    const loadSeries = async () => {
      try {
        setError(null);
        setResumeUrl(null);
        setIsLoading(true);
        setStatus('Fetching weather trend data');
        const range = state.preset === 'custom'
          ? {
            from: new Date(state.customFrom),
            to: new Date(state.customTo),
          }
          : getPresetRange(state.preset);

        if (Number.isNaN(range.from.getTime()) || Number.isNaN(range.to.getTime()) || range.from >= range.to) {
          throw new Error('Choose a valid custom date range before running the query');
        }

        const query = buildWeatherQueryParams({
          dataset: state.dataset,
          fields: state.fields,
          from: range.from,
          to: range.to,
          limit: 1000,
        });

        const response = await fetchWeatherSeries(config, session, query);
        setChartRows(buildChartData(response));
        setAggregationLevel(response.aggregationLevel);
        setStatus(`Showing ${response.rows.length} points using ${aggregationLabel[response.aggregationLevel].toLowerCase()} resolution`);
      } catch (requestError) {
        if (requestError instanceof WeatherApiError) {
          setResumeUrl(requestError.resumeUrl ?? null);
        }

        setError(requestError instanceof Error ? requestError.message : 'Unable to load weather data');
      } finally {
        setIsLoading(false);
      }
    };

    void loadSeries();
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
