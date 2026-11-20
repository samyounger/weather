import { fetchLiveWeather, parseLiveWeather, watchLiveWeather, weatherFreshness, LiveWeather } from './live-weather';
import type { AuthTokens } from '../../../entities/session/model/session';
const data: LiveWeather = {
  observedAt: '2026-11-20T20:00:00Z', retrievedAt: '2026-11-20T20:00:10Z',
  temperatureC: 10, humidityPct: 80, windMph: 5, gustMph: 8, windDirectionDeg: 180,
  pressureHpa: 1000, rainMm: 0, reportIntervalMinutes: 1, source: 'Test station',
};
const config = { apiBaseUrl: 'https://example.test', cognitoRegion: 'test', cognitoUserPoolId: 'test', cognitoClientId: 'test' };
const session = { idToken: 'test-jwt' } as AuthTokens;
describe('live weather contract and freshness', () => {
  it('accepts valid readings and null metrics without converting absence to zero', () => {
    expect(parseLiveWeather(data)).toEqual(data);
    expect(parseLiveWeather({ ...data, temperatureC: null }).temperatureC).toBeNull();
  });
  it.each([null, {}, { ...data, observedAt: 'bad' }, { ...data, retrievedAt: null },
    { ...data, source: 1 }, { ...data, rainMm: '0' }, { ...data, windMph: Infinity },
    { ...data, reportIntervalMinutes: 0 }, { ...data, reportIntervalMinutes: 61 }])('rejects malformed payloads', (value) => { expect(() => parseLiveWeather(value)).toThrow(/not recognised/); });
  it('distinguishes fresh, stale and invalid timestamps', () => {
    const at = Date.parse(data.observedAt);
    expect(weatherFreshness(data.observedAt, at).label).toContain('less than a minute');
    expect(weatherFreshness(data.observedAt, at + 60_000).label).toBe('Observed 1 minute ago');
    expect(weatherFreshness(data.observedAt, at + 120_000).label).toBe('Observed 2 minutes ago');
    expect(weatherFreshness(data.observedAt, at + 300_000).stale).toBe(false);
    expect(weatherFreshness(data.observedAt, at + 300_001).stale).toBe(true);
    expect(weatherFreshness(data.observedAt, at - 120_000).stale).toBe(true);
    expect(weatherFreshness('bad', at).stale).toBe(true);
  });
});
describe('live API', () => {
  beforeEach(() => { global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => data }); });
  it('uses authenticated no-store requests and validates the response', async () => {
    const signal = new AbortController().signal;
    expect(await fetchLiveWeather(config, session, signal)).toEqual(data);
    expect(global.fetch).toHaveBeenCalledWith('https://example.test/live', {
      signal, cache: 'no-store', headers: { Authorization: 'Bearer test-jwt' },
    });
  });
  it.each([401, 403, 503])('handles HTTP %s', async (status) => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status });
    await expect(fetchLiveWeather(config, session, new AbortController().signal)).rejects.toThrow(
      status === 503 ? /unavailable/ : /expired/,
    );
  });
  it('never presents demonstration data as live observations', async () => {
    await expect(fetchLiveWeather({ ...config, mockMode: true }, session, new AbortController().signal)).rejects.toThrow(/demonstration/);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
describe('visible-only refresh lifecycle', () => {
  let visibility: EventTarget & { hidden: boolean };
  const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
  beforeEach(() => { jest.useFakeTimers(); visibility = Object.assign(new EventTarget(), { hidden: false }); });
  afterEach(() => jest.useRealTimers());
  it('loads immediately, refreshes each minute, pauses hidden, refreshes on return and cleans up', async () => {
    const load = jest.fn().mockResolvedValue(data), onData = jest.fn(), onError = jest.fn();
    const watcher = watchLiveWeather(load, onData, onError, visibility);
    await flush(); expect(onData).toHaveBeenCalledWith(data);
    jest.advanceTimersByTime(60_000); await flush(); expect(load).toHaveBeenCalledTimes(2);
    visibility.hidden = true; jest.advanceTimersByTime(60_000); await flush(); expect(load).toHaveBeenCalledTimes(2);
    visibility.hidden = false; visibility.dispatchEvent(new Event('visibilitychange')); await flush();
    expect(load).toHaveBeenCalledTimes(3);
    watcher.refresh(); await flush(); expect(load).toHaveBeenCalledTimes(4);
    watcher.stop(); watcher.refresh(); jest.advanceTimersByTime(60_000); visibility.dispatchEvent(new Event('visibilitychange'));
    expect(load).toHaveBeenCalledTimes(4); expect(onError).not.toHaveBeenCalled();
  });
  it('does not overlap slow requests and suppresses results after unmount', async () => {
    let resolve!: (value: LiveWeather) => void;
    const load = jest.fn().mockImplementation(() => new Promise<LiveWeather>((r) => { resolve = r; }));
    const onData = jest.fn(), onError = jest.fn();
    const watcher = watchLiveWeather(load, onData, onError, visibility);
    watcher.refresh(); expect(load).toHaveBeenCalledTimes(1);
    const signal = load.mock.calls[0][0] as AbortSignal;
    watcher.stop(); expect(signal.aborted).toBe(true); resolve(data); await flush();
    expect(onData).not.toHaveBeenCalled();
  });
  it('times out requests, reports errors and retries without discarding last success', async () => {
    const load = jest.fn().mockImplementation((signal: AbortSignal) => new Promise((_resolve, reject) =>
      signal.addEventListener('abort', () => reject(new Error('Request timed out')))));
    const onError = jest.fn(); const watcher = watchLiveWeather(load, jest.fn(), onError, visibility);
    jest.advanceTimersByTime(15_000); await flush(); expect(onError).toHaveBeenCalledWith('Request timed out');
    load.mockRejectedValueOnce('unknown'); watcher.refresh(); await flush();
    expect(onError).toHaveBeenLastCalledWith('Unable to refresh station observations');
    load.mockResolvedValueOnce(data); watcher.refresh(); await flush(); watcher.stop();
  });
  it('ignores an aborted request error after stopping', async () => {
    const load = jest.fn().mockImplementation((signal: AbortSignal) => new Promise((_resolve, reject) =>
      signal.addEventListener('abort', () => reject(new Error('Aborted')))));
    const error = jest.fn(); const watcher = watchLiveWeather(load, jest.fn(), error, visibility);
    watcher.stop(); await flush(); expect(error).not.toHaveBeenCalled();
  });
});
