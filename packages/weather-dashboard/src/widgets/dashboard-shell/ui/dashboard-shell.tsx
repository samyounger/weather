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
  const [error, setError] = useState<string | null>(null);

  const availableFields = useMemo(
    () => datasetFieldOptions[state.dataset],
    [state.dataset],
  );

  useEffect(() => {
    if (!config || !session || state.fields.length === 0) {
      return;
    }

    const loadSeries = async () => {
      try {
        setError(null);
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
      }
    };

    void loadSeries();
  }, [config, session, state]);

  return (
    <div className="page-layout">
      <section className="app-card hero">
        <div className="button-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
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
          <div style={{ width: '100%', height: 340, marginTop: 20 }}>
            <ResponsiveContainer>
              <LineChart data={chartRows}>
                <CartesianGrid strokeDasharray="4 4" stroke="#cbd8df" />
                <XAxis dataKey="timestampLabel" minTickGap={24} />
                <YAxis />
                <Tooltip />
                <Legend />
                {availableFields
                  .filter((field) => state.fields.includes(field.key))
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
        </section>
      </div>
    </div>
  );
};
