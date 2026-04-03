import { useEffect, useMemo, useState } from 'react';
import { ResponsiveContainer, CartesianGrid, Legend, Line, LineChart, Tooltip, XAxis, YAxis } from 'recharts';
import { buildChartData, buildWeatherQueryParams, datasetFieldOptions, fetchWeatherSeries, WeatherDataset } from '../../../entities/weather';
import { WeatherControls } from '../../../features/weather-controls';
import { LogoutButton } from '../../../features/session-actions';
import { useAuth } from '../../../app/providers/auth-provider';
import { useRuntimeConfig } from '../../../app/providers/runtime-config-provider';
import { getPresetRange } from '../../../shared/lib/date-range';

type QueryState = {
  dataset: WeatherDataset;
  fields: string[];
  preset: '24h' | '72h' | '7d';
};

const initialState: QueryState = {
  dataset: 'refined',
  fields: ['airtemperature_avg', 'relativehumidity_avg'],
  preset: '7d',
};

export const DashboardShell = () => {
  const { session } = useAuth();
  const { config } = useRuntimeConfig();
  const [state, setState] = useState<QueryState>(initialState);
  const [chartRows, setChartRows] = useState<Record<string, string | number | null>[]>([]);
  const [status, setStatus] = useState<string>('Loading latest data');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
          unitLabel: field.unitLabel,
          high: 'N/A',
          low: 'N/A',
          average: 'N/A',
        };
      }

      const high = Math.max(...values);
      const low = Math.min(...values);
      const average = values.reduce((sum, value) => sum + value, 0) / values.length;
      const formatValue = (value: number) => `${value.toFixed(1)} ${field.unitLabel}`;

      return {
        key: field.key,
        label: field.label,
        unitLabel: field.unitLabel,
        high: formatValue(high),
        low: formatValue(low),
        average: formatValue(average),
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
        setIsLoading(true);
        setStatus('Fetching weather data');
        const range = getPresetRange(state.preset);
        const query = buildWeatherQueryParams({
          dataset: state.dataset,
          fields: state.fields,
          from: range.from,
          to: range.to,
          limit: state.dataset === 'raw' ? 500 : 1000,
        });

        const response = await fetchWeatherSeries(config, session, query);
        setChartRows(buildChartData(response));
        setStatus(`Showing ${response.rows.length} points from ${state.dataset} observations`);
      } catch (requestError) {
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
                : 'Authenticated charts for the existing Tempest observation APIs.'}
            </p>
          </div>
          <LogoutButton />
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="app-card hero">
          <WeatherControls
            availableFields={availableFields}
            selectedDataset={state.dataset}
            selectedFields={state.fields}
            selectedPreset={state.preset}
            onDatasetChange={(dataset) => {
              const defaultFields = datasetFieldOptions[dataset].slice(0, 2).map((field) => field.key);
              setState((currentState) => ({
                ...currentState,
                dataset,
                fields: defaultFields,
              }));
            }}
            onFieldsChange={(fields) => setState((currentState) => ({ ...currentState, fields }))}
            onPresetChange={(preset) => setState((currentState) => ({ ...currentState, preset }))}
          />
        </section>

        <section className="app-card chart-card">
          <div className={`status-banner${error ? ' error-banner' : ''}`}>
            {error ?? status}
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
                {selectedFieldOptions
                  .map((field) => (
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
