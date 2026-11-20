import type { RuntimeConfig } from '../../../shared/config/runtime-config';
import type { AuthTokens } from '../../../entities/session/model/session';

export type LiveWeather = {
  observedAt: string; retrievedAt: string; temperatureC: number | null; humidityPct: number | null;
  windMph: number | null; gustMph: number | null; windDirectionDeg: number | null;
  pressureHpa: number | null; rainMm: number | null; reportIntervalMinutes: number; source: string;
};
export const parseLiveWeather = (value: unknown): LiveWeather => {
  const v = value as LiveWeather | null;
  if (!v || !['observedAt', 'retrievedAt'].every((key) => typeof v[key as keyof LiveWeather] === 'string' &&
    Number.isFinite(Date.parse(String(v[key as keyof LiveWeather])))) ||
    typeof v.source !== 'string' || !Number.isFinite(v.reportIntervalMinutes) || v.reportIntervalMinutes < 1 ||
    v.reportIntervalMinutes > 60 ||
    !['temperatureC', 'humidityPct', 'windMph', 'gustMph', 'windDirectionDeg', 'pressureHpa', 'rainMm']
      .every((key) => v[key as keyof LiveWeather] === null ||
        (typeof v[key as keyof LiveWeather] === 'number' && Number.isFinite(v[key as keyof LiveWeather])))) {
    throw new Error('The live weather response was not recognised. Please retry.');
  }
  return v;
};
export const weatherFreshness = (observedAt: string, now = Date.now()) => {
  const age = now - Date.parse(observedAt);
  if (!Number.isFinite(age) || age < -60_000) return { stale: true, label: 'Observation time is invalid' };
  const minutes = Math.max(0, Math.floor(age / 60_000));
  return { stale: age > 5 * 60_000, label: age > 5 * 60_000
    ? `Station data is delayed — ${minutes} minutes old`
    : minutes === 0 ? 'Observed less than a minute ago' : `Observed ${minutes} minute${minutes === 1 ? '' : 's'} ago` };
};
export const fetchLiveWeather = async (config: RuntimeConfig, session: AuthTokens, signal: AbortSignal) => {
  if (config.mockMode) throw new Error('Live station readings are unavailable in demonstration mode.');
  const response = await fetch(`${config.apiBaseUrl}/live`, {
    signal, cache: 'no-store', headers: { Authorization: `Bearer ${session.idToken}` },
  });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403
    ? 'Your session has expired. Sign out and sign in to resume live weather.'
    : 'Current station observations are unavailable. Retrying automatically.');
  return parseLiveWeather(await response.json());
};

// One request at a time; stop background polling and refresh immediately on return to the app.
export const watchLiveWeather = (
  load: (signal: AbortSignal) => Promise<LiveWeather>,
  onData: (data: LiveWeather) => void, onError: (error: string) => void,
  visibility: Pick<Document, 'hidden' | 'addEventListener' | 'removeEventListener'> = document,
) => {
  let stopped = false;
  let active: AbortController | undefined;
  const refresh = async () => {
    if (stopped || visibility.hidden || active) return;
    const controller = new AbortController();
    active = controller;
    const timeout = setTimeout(() => controller.abort(), 15_000);
    try {
      const result = await load(controller.signal);
      if (!stopped) onData(result);
    } catch (error) {
      if (!stopped) onError(error instanceof Error ? error.message : 'Unable to refresh station observations');
    } finally { clearTimeout(timeout); active = undefined; }
  };
  const onVisible = () => { void refresh(); };
  visibility.addEventListener('visibilitychange', onVisible);
  const timer = setInterval(onVisible, 60_000);
  void refresh();
  return {
    refresh: onVisible,
    stop: () => {
      stopped = true; clearInterval(timer); active?.abort();
      visibility.removeEventListener('visibilitychange', onVisible);
    },
  };
};
