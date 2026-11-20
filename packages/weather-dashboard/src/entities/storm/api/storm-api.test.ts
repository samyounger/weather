import { fetchStormCase } from './storm-api';
import type { RuntimeConfig } from '../../../shared/config/runtime-config';
import type { AuthTokens } from '../../session/model/session';

const config = { apiBaseUrl: 'https://weather.test', mockMode: false } as RuntimeConfig;
const session = { idToken: 'private-jwt' } as AuthTokens;

beforeEach(() => { global.fetch = jest.fn(); });

describe('storm API', () => {

  it('only uses synthetic/empty data when local mock mode is explicitly enabled', async () => {
    const result = await fetchStormCase({ ...config, mockMode: true }, session);
    expect(result.event.observedMinutes).toBe(0);
    expect(result.event.peakGust).toBeNull();
    expect(result.source).toContain('not real');
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('sends JWT and abort signal to the authenticated fixed-case endpoint', async () => {
    const payload = await fetchStormCase({ ...config, mockMode: true }, session);
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => payload });
    const controller = new AbortController();
    expect(await fetchStormCase(config, session, controller.signal)).toEqual(payload);
    expect(global.fetch).toHaveBeenCalledWith('https://weather.test/storms/eowyn', {
      headers: { Authorization: 'Bearer private-jwt' }, signal: expect.any(AbortSignal),
    });
  });

  it.each([401, 403, 503])('handles HTTP %s without a mock fallback', async (status) => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status });
    await expect(fetchStormCase(config, session)).rejects.toThrow(status === 503 ? 'temporarily unavailable' : 'session has expired');
  });

  it.each([
    { id: 'other' }, { id: 'eowyn' }, { id: 'eowyn', event: {} },
    { id: 'eowyn', event: { hourly: [] } },
  ])('rejects malformed history rather than displaying untrusted figures', async (payload) => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true, json: async () => payload });
    await expect(fetchStormCase(config, session)).rejects.toThrow('not recognised');
  });

  it('propagates network aborts and does not substitute local sample observations', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Aborted'));
    await expect(fetchStormCase(config, session)).rejects.toThrow('Aborted');
  });
});

it('bounds a stalled request and offers a retryable timeout instead of loading indefinitely', async () => {
  const deadline = new AbortController();
  const timeout = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
  (global.fetch as jest.Mock).mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
  }));
  const pending = fetchStormCase(config, session);
  expect(timeout).toHaveBeenCalledWith(25_000);
  deadline.abort();
  await expect(pending).rejects.toThrow('timed out');
  timeout.mockRestore();
});

it('bounds a stalled response body as well as the initial request', async () => {
  const deadline = new AbortController();
  const timeout = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(deadline.signal);
  (global.fetch as jest.Mock).mockImplementation(async (_url, options) => ({
    ok: true, json: () => new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(new Error('Aborted')), { once: true });
    }),
  }));
  const pending = fetchStormCase(config, session);
  await Promise.resolve();
  deadline.abort();
  await expect(pending).rejects.toThrow('timed out');
  timeout.mockRestore();
});
