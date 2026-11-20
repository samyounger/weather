import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../../../app/providers/auth-provider';
import { useRuntimeConfig } from '../../../app/providers/runtime-config-provider';
import {
  coverageText, fetchStormCase, formatValue, gustComparison, localTime,
  sourceFor, stormMilestones, stormSources, StormCase, StormSummary,
} from '../../../entities/storm';
import { LogoutButton } from '../../../features/session-actions';

const EvidenceLink = ({ id, children }: { id: string; children?: string }) => (
  <a href={sourceFor(id).url} target="_blank" rel="noopener noreferrer">
    {children ?? sourceFor(id).title} <span className="sr-only">(opens in a new tab)</span>
  </a>
);
const pct = (fraction: number) => coverageText(fraction);
const Metric = ({ label, value, detail }: { label: string; value: string; detail: string }) => (
  <div className="storm-metric"><dt>{label}</dt><dd>{value}</dd><p>{detail}</p></div>
);

const LocalSummary = ({ event }: { event: StormSummary }) => (
  <>
    <dl className="storm-metrics">
      <Metric label="Highest measured gust" value={formatValue(event.peakGust?.mph ?? null, 'mph')}
        detail={`${event.peakGust ? localTime(event.peakGust.at) + ' · ' : ''}${pct(event.coverage.gust)}`} />
      <Metric label="Reported rain subtotal" value={formatValue(event.rainMm, 'mm')}
        detail={pct(event.coverage.rain) + ' · raw sensor rain · gaps not estimated'} />
      <Metric label="Sampled temperature range"
        value={event.temperature ? `${event.temperature.minC.toFixed(1)} to ${event.temperature.maxC.toFixed(1)} °C` : 'Unavailable'}
        detail={pct(event.coverage.temperature)} />
      <Metric label="Lowest station pressure" value={formatValue(event.minPressure?.hpa ?? null, 'hPa')}
        detail={`${event.minPressure ? localTime(event.minPressure.at) + ' · ' : ''}${pct(event.coverage.pressure)} · not sea-level adjusted`} />
    </dl>
    <p className="muted">{event.observedMinutes.toLocaleString('en-GB')} of {event.expectedMinutes.toLocaleString('en-GB')} expected minute reports usable.
      {' '}{event.rejectedRows} malformed/non-minute reports and {event.conflictingMinutes} conflicting minutes excluded.</p>
  </>
);

const RegionalJourney = () => (
  <figure className="storm-journey">
    <svg viewBox="0 0 720 150" role="img" aria-labelledby="journey-title journey-desc">
      <title id="journey-title">Éowyn's regional journey</title>
      <desc id="journey-desc">Schematic, not a plotted storm track. Atlantic development on 23 January; off County Donegal at 06:00 on 24 January; over Argyll at 08:00; northern Scotland later on 24 January. Exact formation and final dissipation are unknown.</desc>
      <path d="M70 96 Q200 122 284 82 T470 65 T650 30" fill="none" stroke="#afc1c8" strokeWidth="3" strokeDasharray="7 7" />
      {[{ x: 70, y: 96, title: 'Atlantic', time: '23 Jan' }, { x: 284, y: 82, title: 'Donegal coast', time: '24 Jan · 06:00' }, { x: 470, y: 65, title: 'Argyll', time: '24 Jan · 08:00' }, { x: 650, y: 30, title: 'N. Scotland', time: '24 Jan' }].map((point, i) => (
        <g key={point.title}>
          <circle cx={point.x} cy={point.y} r="16" fill="#16324f" />
          <text x={point.x} y={point.y + 5} textAnchor="middle" fill="white" fontSize="14">{i + 1}</text>
          <text x={point.x} y={point.y + 34} textAnchor="middle" fill="#16324f" fontSize="14">{point.title}</text>
          <text x={point.x} y={point.y + 52} textAnchor="middle" fill="#435e73" fontSize="12">{point.time}</text>
        </g>
      ))}
    </svg>
    <figcaption>Regional journey schematic · north-eastward movement, not exact centre positions or a forecast track. <EvidenceLink id="report">Source: Met Office report, pp. 1–5</EvidenceLink></figcaption>
  </figure>
);

const Replay = ({ event }: { event: StormSummary }) => {
  const [threshold, setThreshold] = useState(40);
  const episode = event.episodes.find((item) => item.thresholdMph === threshold);
  return (
    <section className="app-card storm-section" aria-labelledby="replay-heading">
      <p className="storm-eyebrow">Weather detective</p>
      <h2 id="replay-heading">Find the local turning points</h2>
      <p>Hourly peaks reveal the sequence. Blank hours mean no usable observations; rain is the observed subtotal, not an estimated full-hour total.</p>
      {event.coverage.gust > 0 ? (
        <div className="storm-chart" role="img" aria-label="Hourly measured peak gusts in miles per hour. Exact values follow in the expandable table.">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={event.hourly}>
              <CartesianGrid stroke="#d6e0e4" strokeDasharray="3 3" />
              <XAxis dataKey="at" tickFormatter={localTime} minTickGap={60} />
              <YAxis unit=" mph" width={72} />
              <Tooltip labelFormatter={(value) => localTime(String(value))} formatter={(value) => [formatValue(value as number | null, 'mph'), 'Hourly peak gust']} />
              <Line type="linear" dataKey="gustMph" stroke="#b05432" strokeWidth={2} dot={false} connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : <p className="status-banner">{event.observedMinutes === 0 ? 'No station reports are available for this window.' : 'The available reports contain no usable gust observations.'} The sourced regional story is still available below.</p>}
      <label className="storm-threshold">
        Explore minutes with a sampled gust at or above
        <select id="gust-threshold" disabled={event.coverage.gust === 0} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))}>
          {[30, 40, 50].map((value) => <option key={value} value={value}>{value} mph</option>)}
        </select>
      </label>
      {episode && event.coverage.gust > 0 ? <div aria-live="polite" className="storm-callout">
        <strong>{episode.qualifyingMinutes} sampled minutes</strong> at or above {threshold} mph.
        {' '}Longest uninterrupted run: <strong>{episode.longestRunMinutes} minutes</strong>.
        {episode.firstAt && episode.lastAt ? <p>First qualifying report: {localTime(episode.firstAt)}. Last: {localTime(episode.lastAt)}.</p> : <p>No qualifying gust was observed in the available reports.</p>}
      </div> : <p className="storm-callout">No usable gust observations; threshold activity is unavailable, not zero.</p>}
      <p className="muted">Gusts are brief peaks, not sustained winds. Missing or invalid gust reports break a run. First/last threshold crossings do not establish the storm’s exact arrival, departure or total lifetime.</p>
      <details>
        <summary>Inspect hourly observations and coverage</summary>
        <div className="storm-table-scroll" tabIndex={0} role="region" aria-label="Hourly observation evidence">
          <table className="summary-table">
            <caption>Europe/London · hour beginning · samples are minute reports ending within that hour</caption>
            <thead><tr><th scope="col">Hour</th><th scope="col">Peak gust (mph)</th><th scope="col">Rain (mm)</th><th scope="col">Mean pressure (hPa)</th><th scope="col">Mean temp (°C)</th><th scope="col">Reports / 60</th></tr></thead>
            <tbody>{event.hourly.map((hour) => (
              <tr key={hour.at}><th scope="row">{localTime(hour.at)}</th><td>{formatValue(hour.gustMph)}<small className="storm-cell-coverage">{hour.coverageMinutes.gust}/60 valid minutes</small></td><td>{formatValue(hour.rainMm)}<small className="storm-cell-coverage">{hour.coverageMinutes.rain}/60 valid minutes</small></td><td>{formatValue(hour.pressureHpa)}<small className="storm-cell-coverage">{hour.coverageMinutes.pressure}/60 valid minutes</small></td><td>{formatValue(hour.temperatureC)}<small className="storm-cell-coverage">{hour.coverageMinutes.temperature}/60 valid minutes</small></td><td>{hour.minutes}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </details>
    </section>
  );
};

export const StormStory = () => {
  const { session } = useAuth();
  const { config } = useRuntimeConfig();
  const [data, setData] = useState<StormCase | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!config || !session) {
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);
    fetchStormCase(config, session, controller.signal).then((result) => {
      if (!controller.signal.aborted) {
        setData(result);
      }
    }).catch((cause: unknown) => {
      if (!controller.signal.aborted) {
        setError(cause instanceof Error ? cause.message : 'Station history is unavailable.');
      }
    }).finally(() => {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    });
    return () => controller.abort();
  }, [config, session, attempt]);

  return (
    <article className="page-layout storm-story">
      <header className="app-card storm-cover">
        <div className="hero-actions"><p className="storm-eyebrow">The weather, understood · Case 01</p><LogoutButton /></div>
        <p className="storm-date">Historical case · 23–25 January 2025</p>
        <h1>Éowyn.<br /><span>From the Atlantic to home.</span></h1>
        <p className="storm-intro">A rapidly deepening Atlantic storm crossed Ireland and Scotland, bringing exceptional winds.
          Follow its wider journey, then discover what your own station measured.</p>
        <nav className="storm-jump-links" aria-label="Explore the storm">
          <a href="#local-story">At home</a><a href="#lifecycle">The journey</a><a href="#replay-heading">Investigate</a><a href="#almanac">In perspective</a><a href="#forecast">What was predicted</a>
        </nav>
        <p className="muted"><EvidenceLink id="report">Regional story: Met Office event report</EvidenceLink>. This is a historical account, not a live forecast or warning service.</p>
        {config?.mockMode ? <p className="status-banner">Local demonstration mode. No real station measurements are displayed.</p> : null}
      </header>

      <section className="app-card storm-section" id="local-story" aria-labelledby="local-heading">
        <p className="storm-eyebrow">The local weather story</p>
        <h2 id="local-heading">{data?.station.name ?? 'What happened at home?'}</h2>
        <p>23 January 00:00 to 26 January 00:00, Europe/London (GMT). A three-day observation window, not a claim about the storm’s full lifetime.</p>
        {loading ? <p role="status" className="status-banner">Retrieving historical station observations…</p> : null}
        {error ? <div role="alert" className="status-banner error-banner"><p>{error}</p><button className="button-primary" onClick={() => setAttempt((n) => n + 1)}>Retry station history</button></div> : null}
        {data ? <><LocalSummary event={data.event} /><p className="muted">Source: {data.source}. Retrieved {localTime(data.retrievedAt)} {new Date(data.retrievedAt).getFullYear()}; server cache up to one hour.</p></> : null}
      </section>

      <section className="app-card storm-section" id="lifecycle" aria-labelledby="lifecycle-heading">
        <p className="storm-eyebrow">The wider journey</p>
        <h2 id="lifecycle-heading">Named before it even formed</h2>
        <p>A powerful jet stream fuelled rapid development. Central pressure fell 50 hPa in 24 hours, more than twice the 24 hPa threshold used to describe explosive cyclogenesis. <EvidenceLink id="report">Met Office analysis</EvidenceLink></p>
        <RegionalJourney />
        <ol className="storm-timeline">{stormMilestones.map((item) => (
          <li key={item.title}><p className="storm-eyebrow">{item.date}</p><h3>{item.title}</h3><p>{item.text}</p><EvidenceLink id={item.source}>Open primary evidence</EvidenceLink></li>
        ))}</ol>
      </section>

      {data ? <Replay event={data.event} /> : <section className="app-card storm-section" aria-labelledby="replay-heading"><h2 id="replay-heading">Local replay</h2><p>Load station history above to explore local peak timing and gust-threshold episodes.</p></section>}

      <section className="app-card storm-section" id="almanac" aria-labelledby="almanac-heading">
        <p className="storm-eyebrow">The local almanac</p><h2 id="almanac-heading">Unusual here — or simply January?</h2>
        <p>Reference: the same 23–25 January dates in 2026 at the same station. One seasonal comparison is not a climate normal, a typical January, or a full-history record ranking.</p>
        {data?.comparison ? <>
          <p className="storm-callout">{gustComparison(data.event, data.comparison)}</p>
          <details><summary>Inspect the 2026 reference measurements</summary><LocalSummary event={data.comparison} /></details>
        </> : <p className="muted">{data?.comparisonError ?? 'The reference will appear after station history loads.'}</p>}
        {data?.comparisonError && !config?.mockMode ? <><p className="muted">If it has just failed, please allow about 30 seconds before trying again.</p><button className="button-secondary" onClick={() => setAttempt((n) => n + 1)}>Retry reference history</button></> : null}
        <p>National context: the Met Office reported a 100 mph gust at Drumalbin and January gust records at 15 UK stations with over ten years of history. Those are not your station’s measurements or records. <EvidenceLink id="review">Read the retrospective analysis</EvidenceLink></p>
      </section>

      <section className="app-card storm-section" id="forecast" aria-labelledby="forecast-heading">
        <p className="storm-eyebrow">Forecasts, warnings & outcomes</p><h2 id="forecast-heading">What was known beforehand?</h2>
        <div className="storm-evidence-grid">
          <div><h3>21 January · 12:16 UTC</h3><p>The naming forecast anticipated gusts above 80 mph at exposed sites in several regions, including western Scotland. It did not predict a record at this station.</p><EvidenceLink id="naming">Published pre-event forecast</EvidenceLink></div>
          <div><h3>23 January · 10:12 UTC</h3><p>The regional forecast expected 80–90 mph gusts quite widely within red-warning areas and potentially 100 mph on exposed coasts. Scotland’s regional red warning was valid 10:00–17:00 on 24 January; the southern-Scotland amber warning 06:00–21:00.</p><EvidenceLink id="forecast">Published forecast and warning context</EvidenceLink></div>
          <div><h3>23 January · 17:50 UTC</h3><p>The UK and Scottish Governments sent an emergency alert explicitly including Scottish Borders. This verifies regional relevance, not whether the station lay inside the original warning polygon.</p><EvidenceLink id="alert">Historical government alert</EvidenceLink></div>
          <div><h3>After the storm</h3><p>The later analysis reports a 100 mph UK peak at Drumalbin. That supports the scale of the regional threat, but does not measure forecast accuracy at home.</p><EvidenceLink id="review">Retrospective outcome</EvidenceLink></div>
        </div>
        <p className="muted">Published articles were retrieved on 20 November 2026, not saved by this app before the storm. Original numeric point forecasts and warning polygons have not been recovered, so no local forecast skill score or predicted-record claim is made.</p>
        <p><a href="https://weather.metoffice.gov.uk/warnings-and-advice/uk-warnings" target="_blank" rel="noopener noreferrer">For current warnings, visit the Met Office</a> — separate from this historical case.</p>
      </section>

      <section className="app-card storm-section" aria-labelledby="evidence-heading">
        <p className="storm-eyebrow">Show your workings</p><h2 id="evidence-heading">Every story needs evidence</h2>
        <details><summary>How the local figures are calculated</summary>
          <p>Minute Tempest reports are requested explicitly (bucket=a). Each timestamp represents the end of a one-minute reporting interval. Identical copies count once; conflicting copies are omitted. Non-minute intervals and malformed values are not interpolated.</p>
          <p>Gust is the highest reported short gust, converted from m/s to mph. Temperature shows extremes of available minute samples, not extremes of hourly averages. Rain adds raw sensor interval amounts (not cumulative local-day readings or corrected Rain Check totals); with gaps it is only a reported subtotal, not a quality-controlled rain-gauge total. Pressure is measured at the station, not corrected to sea level.</p>
          <p>Coverage is valid metric minutes / 4,320 expected minutes. Coverage is not a sensor-accuracy guarantee. Hourly averages are equally weighted valid minute samples; missing hours remain blank. The gust comparison requires at least 95% valid gust minutes in both windows, and remains a comparison of measured peaks, not proof of complete coverage.</p>
          <p>No exact formation time, full storm lifetime, local warning polygon membership, local forecast skill or station-wide record is inferred from these sources. Other periods remain available in the trend explorer.</p>
        </details>
        <details><summary>Primary sources, dates and free-data terms</summary>
          <ul className="storm-sources">{stormSources.map((source) => <li key={source.id}><EvidenceLink id={source.id} /><p>{source.publisher} · {source.published} · retrieved 20 November 2026.</p></li>)}</ul>
          <p>Contains public sector information from the Met Office and GOV.UK, licensed under the <a href="https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/" target="_blank" rel="noopener noreferrer">Open Government Licence v3.0</a>. © Crown copyright. Text is paraphrased; third-party imagery is not reproduced.</p>
          <p>Station history uses the existing personal Tempest integration. No paid datasets, subscriptions or map tiles are used. Existing AWS infrastructure remains in use.</p>
        </details>
      </section>
    </article>
  );
};
