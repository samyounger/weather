import type { APIGatewayProxyResult } from 'aws-lambda';
import type { StormCase } from '@weather/cloud-computing';
import { summariseStorm } from './storm-observations';

const SOURCE = 'Tempest device history, minute reports (bucket=a)';
const WINDOW = ['2025-01-23T00:00:00.000Z', '2025-01-26T00:00:00.000Z'] as const;
const REFERENCE = ['2026-01-23T00:00:00.000Z', '2026-01-26T00:00:00.000Z'] as const;
const CACHE_MS = 60 * 60_000;

type Configuration = { host: string; token: string; device: string; station: string };
type TempestPayload = {
  status?: { status_code?: number };
  type?: string;
  obs?: unknown[];
  stations?: {
    station_id: number; name?: string; timezone?: string; created_epoch?: number;
    devices?: { device_id: number }[];
  }[];
};
type Cache = { key: string; expires: number; data?: StormCase; pending?: Promise<StormCase> };
let cache: Cache | undefined;

const configuration = (): Configuration => {
  const { TEMPEST_TOKEN: token, TEMPEST_DEVICE_ID: device, TEMPEST_STATION_ID: station } = process.env;
  const host = (process.env.TEMPEST_HOST ?? '').replace(/^https:\/\//, '').replace(/\/$/, '');
  if (!token || !device || !station || !/^\d+$/.test(device) || !/^\d+$/.test(station) ||
      !['swd.weatherflow.com', 'api.weatherflow.com'].includes(host)) {
    throw new Error('Weather integration is unavailable');
  }
  return { host, token, device, station };
};

const fetchPayload = async (config: Configuration, path: string, signal: AbortSignal, params: Record<string, string> = {}) => {
  const url = new URL(`https://${config.host}/swd/rest${path}`);
  url.search = new URLSearchParams({ ...params, token: config.token }).toString();
  const response = await fetch(url, { signal });
  if (!response.ok) {
    throw new Error('Weather source request failed');
  }
  const payload = await response.json() as TempestPayload | null;
  if (!payload || payload.status?.status_code !== 0) {
    throw new Error('Weather source rejected the request');
  }
  return payload;
};

const fetchWindow = async (
  config: Configuration, range: readonly [string, string], signal: AbortSignal,
) => {
  const payload = await fetchPayload(config, `/observations/device/${config.device}`, signal, {
    time_start: String(Date.parse(range[0]) / 1000),
    time_end: String(Date.parse(range[1]) / 1000), bucket: 'a',
  });
  if (payload.type !== 'obs_st' || !Array.isArray(payload.obs) || payload.obs.length > 10_000) {
    throw new Error('Unexpected historical observations');
  }
  return summariseStorm(payload.obs, range[0], range[1]);
};

const loadCase = async (config: Configuration): Promise<StormCase> => {
  // One deadline spans all sequential requests, below API Gateway's integration limit.
  const signal = AbortSignal.timeout(20_000);
  const metadata = await fetchPayload(config, `/stations/${config.station}`, signal);
  const station = metadata.stations?.find((s: { station_id: number }) => String(s.station_id) === config.station);
  if (!station || station.timezone !== 'Europe/London' ||
      !station.devices?.some((device: { device_id: number }) => String(device.device_id) === config.device)) {
    throw new Error('Station configuration could not be verified');
  }
  const event = await fetchWindow(config, WINDOW, signal);
  let comparison: StormCase['comparison'] = null;
  let comparisonError: string | null = null;
  try {
    comparison = await fetchWindow(config, REFERENCE, signal);
  } catch {
    comparisonError = 'The same-date reference could not be retrieved. The storm observations remain available.';
  }
  return {
    id: 'eowyn', retrievedAt: new Date().toISOString(),
    station: {
      name: typeof station.name === 'string' ? station.name : 'Configured station',
      timeZone: 'Europe/London',
      historySince: typeof station.created_epoch === 'number' && Number.isFinite(station.created_epoch) &&
        station.created_epoch > 0 && station.created_epoch < 10_000_000_000
        ? new Date(station.created_epoch * 1000).toISOString() : null,
    },
    event, comparison, comparisonError, source: SOURCE,
  };
};

const cachedCase = async () => {
  const config = configuration();
  const key = JSON.stringify(config);
  if (cache?.key === key && cache.expires > Date.now()) {
    if (cache.data) {
      return cache.data;
    }
    if (cache.pending) {
      return cache.pending;
    }
  }
  const entry: Cache = { key, expires: Date.now() + CACHE_MS };
  cache = entry;
  entry.pending = loadCase(config);
  try {
    const data = await entry.pending;
    entry.data = data;
    // Failed references should be retryable promptly rather than cached for an hour.
    entry.expires = Date.now() + (data.comparisonError ? 30_000 : CACHE_MS);
    entry.pending = undefined;
    return data;
  } catch {
    if (cache === entry) {
      cache = undefined;
    }
    throw new Error('Weather history is temporarily unavailable');
  }
};

export const handleStorm = async (): Promise<APIGatewayProxyResult> => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' };
  try {
    return { statusCode: 200, headers, body: JSON.stringify(await cachedCase()) };
  } catch {
    // Do not log raw upstream errors: they may contain the credential-bearing request URL.
    console.warn('Historical storm observations unavailable', { service: 'fetch-observations' });
    return { statusCode: 503, headers, body: JSON.stringify({
      error: 'Station history could not be loaded. Please retry shortly. No sample data has been substituted.',
    }) };
  }
};
