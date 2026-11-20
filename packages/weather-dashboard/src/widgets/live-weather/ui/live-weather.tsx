import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../../app/providers/auth-provider';
import { useRuntimeConfig } from '../../../app/providers/runtime-config-provider';
import { LogoutButton } from '../../../features/session-actions';
import { fetchLiveWeather, LiveWeather as Reading, watchLiveWeather, weatherFreshness } from '../model/live-weather';

export const LiveWeather = () => {
  const { session } = useAuth();
  const { config } = useRuntimeConfig();
  const [data, setData] = useState<Reading | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const refresh = useRef<() => void>(() => undefined);
  useEffect(() => {
    if (!config || !session) return;
    const watcher = watchLiveWeather(
      (signal) => fetchLiveWeather(config, session, signal),
      (reading) => { setData(reading); setError(null); setNow(Date.now()); }, setError,
    );
    refresh.current = watcher.refresh;
    const clock = setInterval(() => setNow(Date.now()), 10_000);
    return () => { watcher.stop(); clearInterval(clock); };
  }, [config, session]);
  const freshness = data ? weatherFreshness(data.observedAt, now) : null;
  const metric = (value: number | null, unit: string) => value === null ? 'Unavailable' : `${value.toFixed(1)} ${unit}`;
  return (
    <section className="page-layout" aria-labelledby="live-heading">
      <div className="app-card hero">
        <div className="hero-actions">
          <div><h1 id="live-heading">Live weather at Huntshaw</h1>
            <p className="muted">Your station’s latest report. Refreshes every minute while this app is visible.</p>
          </div><LogoutButton />
        </div>
        <div className="button-row"><button className="button-secondary" onClick={() => refresh.current()}>Refresh now</button></div>
        {error ? <p role="alert">{error}{data ? ' The last successful reading is shown below.' : ''}</p> : null}
        {!data && !error ? <p role="status">Loading current station observations…</p> : null}
        {freshness ? <p role="status" className={freshness.stale ? 'status-banner error-banner' : 'status-banner'}>{freshness.label}</p> : null}
        {data ? <>
          <p>Observed: <time dateTime={data.observedAt}>{new Date(data.observedAt).toLocaleString('en-GB', { timeZone: 'Europe/London', timeZoneName: 'short' })}</time></p>
          <div className="live-metrics">
            {[['Temperature', metric(data.temperatureC, '°C')], ['Humidity', metric(data.humidityPct, '%')],
              ['Wind', metric(data.windMph, 'mph')], ['Gust', metric(data.gustMph, 'mph')],
              ['Wind direction', metric(data.windDirectionDeg, '°')],
              ['Station pressure', metric(data.pressureHpa, 'hPa')],
              [`Rain in reported ${data.reportIntervalMinutes}-minute interval`, metric(data.rainMm, 'mm')]]
              .map(([label, value]) => <div className="app-card" key={label}><h2>{label}</h2><p className="live-value">{value}</p></div>)}
          </div>
          <p className="muted">Source: {data.source}. This is the station’s latest available observation, not a forecast or an archived trend. Delays over five minutes are flagged.</p>
        </> : null}
      </div>
    </section>
  );
};
