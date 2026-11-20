import type { APIGatewayProxyResult } from 'aws-lambda';

type LiveReading = {
  observedAt: string; retrievedAt: string; temperatureC: number | null;
  humidityPct: number | null; windMph: number | null; gustMph: number | null;
  windDirectionDeg: number | null; pressureHpa: number | null;
  rainMm: number | null; reportIntervalMinutes: number; source: string;
};
const metric = (v: unknown, min: number, max: number): number | null =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max ? v : null;
const mph = (v: unknown) => { const n = metric(v, 0, 150); return n === null ? null : n * 2.2369362920544; };

export const parseLiveObservation = (payload: unknown, now = Date.now()): LiveReading => {
  const p = payload as { status?: { status_code?: number }; type?: string; obs?: unknown[] } | null;
  if (p?.status?.status_code !== 0 || p.type !== 'obs_st' || !Array.isArray(p.obs)) {
    throw new Error('Unexpected current observations');
  }
  const rows = p.obs.filter((r): r is unknown[] => Array.isArray(r) && r.length >= 18 &&
    typeof r[0] === 'number' && Number.isFinite(r[0]) && r[0] >= 946684800 &&
    r[0] * 1000 <= now + 60_000 && metric(r[17], 1, 60) !== null);
  const row = rows.sort((a, b) => Number(b[0]) - Number(a[0]))[0];
  if (!row) throw new Error('No current station reports');
  return {
    observedAt: new Date(Number(row[0]) * 1000).toISOString(), retrievedAt: new Date(now).toISOString(),
    temperatureC: metric(row[7], -100, 70), humidityPct: metric(row[8], 0, 100),
    windMph: mph(row[2]), gustMph: mph(row[3]), windDirectionDeg: metric(row[4], 0, 360),
    pressureHpa: metric(row[6], 800, 1100), rainMm: metric(row[12], 0, 100),
    reportIntervalMinutes: Number(row[17]), source: 'Tempest station observations',
  };
};

let cache: { key: string; expires: number; pending: Promise<LiveReading> } | undefined;
const loadLive = async () => {
  const { TEMPEST_TOKEN: token, TEMPEST_DEVICE_ID: device } = process.env;
  const host = (process.env.TEMPEST_HOST ?? '').replace(/^https:\/\//, '').replace(/\/$/, '');
  if (!token || !device || !/^\d+$/.test(device) || !['swd.weatherflow.com', 'api.weatherflow.com'].includes(host)) {
    throw new Error('Weather integration unavailable');
  }
  const key = JSON.stringify([host, device, token]);
  if (cache?.key === key && cache.expires > Date.now()) return cache.pending;
  const entry = { key, expires: Date.now() + 30_000, pending: (async () => {
    const url = new URL(`https://${host}/swd/rest/observations/device/${device}`);
    url.search = new URLSearchParams({ token }).toString();
    const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error('Weather source unavailable');
    return parseLiveObservation(await response.json());
  })() };
  cache = entry;
  try { return await entry.pending; } catch {
    if (cache === entry) cache = undefined;
    throw new Error('Current weather unavailable');
  }
};

export const handleLive = async (): Promise<APIGatewayProxyResult> => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' };
  try {
    return { statusCode: 200, headers, body: JSON.stringify(await loadLive()) };
  } catch {
    // Never log upstream errors or URLs: they can contain the Tempest credential.
    return { statusCode: 503, headers, body: JSON.stringify({ error: 'Current station observations are unavailable. Please retry.' }) };
  }
};
