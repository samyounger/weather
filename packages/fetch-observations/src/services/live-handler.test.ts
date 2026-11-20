import { handleLive, parseLiveObservation } from './live-handler';

const now = Date.now();
const row = (at = now / 1000) => [at, 1, 2, 3, 180, 60, 1000, 10, 80, 0, 0, 0, 0.2, 0, 0, 0, 2.5, 1];
const payload = (obs: unknown[] = [row()]) => ({ status: { status_code: 0 }, type: 'obs_st', obs });

describe('current station observations', () => {
  it('maps Tempest fields, mph conversion and report timestamps', () => {
    const result = parseLiveObservation(payload(), now);
    expect(result).toMatchObject({ observedAt: new Date(now).toISOString(), temperatureC: 10,
      humidityPct: 80, pressureHpa: 1000, rainMm: 0.2, windDirectionDeg: 180, reportIntervalMinutes: 1 });
    expect(result.windMph).toBeCloseTo(4.47387);
    expect(result.gustMph).toBeCloseTo(6.7108);
  });
  it('selects the newest report, preserving a stale observation timestamp', () => {
    const old = now - 3600_000;
    expect(parseLiveObservation(payload([row(old / 1000), row((old - 60_000) / 1000)]), now).observedAt)
      .toBe(new Date(old).toISOString());
  });
  it.each([null, {}, { ...payload(), type: 'obs_air' }, { ...payload(), obs: null },
    { ...payload(), status: { status_code: 1 } }, payload([]), payload([null, [], row((now + 120_000) / 1000)])])('rejects invalid upstream responses without inventing observations', (value) => {
    expect(() => parseLiveObservation(value, now)).toThrow();
  });
  it('keeps missing and impossible metrics null, retaining valid zero rain', () => {
    const r = row(); r[2] = -1; r[3] = NaN; r[4] = 900; r[6] = 500; r[7] = 999; r[8] = -1; r[12] = 0;
    expect(parseLiveObservation(payload([r]), now)).toMatchObject({ windMph: null, gustMph: null,
      windDirectionDeg: null, pressureHpa: null, temperatureC: null, humidityPct: null, rainMm: 0 });
  });
});

describe('live handler', () => {
  const env = { ...process.env };
  beforeEach(() => {
    jest.resetModules(); jest.useFakeTimers(); jest.setSystemTime(now);
    process.env.TEMPEST_HOST = 'swd.weatherflow.com'; process.env.TEMPEST_DEVICE_ID = '123';
    process.env.TEMPEST_TOKEN = 'private-test-token';
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => payload() });
  });
  afterEach(() => { process.env = { ...env }; jest.useRealTimers(); jest.restoreAllMocks(); });
  const handler = async () => (await import('./live-handler')).handleLive;
  it('returns private no-store readings and deduplicates concurrent requests', async () => {
    const run = await handler(); const results = await Promise.all([run(), run()]);
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(results[0].statusCode).toBe(200); expect(results[0].headers?.['Cache-Control']).toBe('private, no-store');
    expect(results[0].body).not.toContain('private-test-token');
    expect(JSON.parse(results[0].body).temperatureC).toBe(10);
    jest.advanceTimersByTime(31_000); await run(); expect(global.fetch).toHaveBeenCalledTimes(2);
  });
  it.each(['TEMPEST_TOKEN', 'TEMPEST_DEVICE_ID', 'TEMPEST_HOST'])('fails closed on absent %s', async (key) => {
    delete process.env[key]; expect((await (await handler())()).statusCode).toBe(503);
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it.each([['TEMPEST_HOST', 'evil.test'], ['TEMPEST_DEVICE_ID', '../123']])('rejects unsafe configuration %s', async (key, value) => {
    process.env[key] = value; expect((await (await handler())()).statusCode).toBe(503);
  });
  it('accepts the alternative allowed host and retries failed source requests immediately', async () => {
    process.env.TEMPEST_HOST = 'https://api.weatherflow.com/';
    const run = await handler(); (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false });
    expect((await run()).statusCode).toBe(503); expect((await run()).statusCode).toBe(200);
  });
  it('handles malformed source responses and abort failures without leaking credentials', async () => {
    const run = await handler();
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('private-test-token'));
    const result = await run(); expect(result.statusCode).toBe(503); expect(result.body).not.toContain('private-test-token');
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: async () => null });
    expect((await run()).statusCode).toBe(503);
  });
  it('exports a handler', () => { expect(typeof handleLive).toBe('function'); });
});
