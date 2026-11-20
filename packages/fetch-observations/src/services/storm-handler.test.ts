import type { APIGatewayProxyResult } from 'aws-lambda';

const env = { ...process.env };
const metadata = () => ({
  status: { status_code: 0 },
  stations: [{ station_id: 123, name: 'Test station', timezone: 'Europe/London', created_epoch: 1716818580, devices: [{ device_id: 456 }] }],
});
const observations = () => ({ status: { status_code: 0 }, type: 'obs_st', obs: [] });
const response = (body: unknown, ok = true) => ({ ok, json: async () => body });
let run: () => Promise<APIGatewayProxyResult>;
let mockFetch: jest.Mock;

beforeEach(async () => {
  jest.resetModules();
  process.env = { ...env, TEMPEST_HOST: 'swd.weatherflow.com', TEMPEST_TOKEN: 'test-private-token', TEMPEST_DEVICE_ID: '456', TEMPEST_STATION_ID: '123' };
  mockFetch = jest.fn().mockResolvedValue(response(observations()));
  mockFetch.mockResolvedValueOnce(response(metadata()));
  global.fetch = mockFetch;
  run = (await import('./storm-handler')).handleStorm;
});
afterEach(() => { process.env = { ...env }; jest.useRealTimers(); });

describe('historical storm handler', () => {
  it('returns actual typed history without credentials or coordinates and only fixed upstream windows', async () => {
    const result = await run();
    expect(result.statusCode).toBe(200);
    const data = JSON.parse(result.body);
    expect(data.station).toEqual({ name: 'Test station', timeZone: 'Europe/London', historySince: '2024-05-27T14:03:00.000Z' });
    expect(data.event.observedMinutes).toBe(0);
    expect(data.comparison).not.toBeNull();
    expect(result.headers?.['Cache-Control']).toBe('private, no-store');
    expect(result.body).not.toContain('test-private-token');
    const url = String(mockFetch.mock.calls[1][0]);
    expect(url).toContain('/observations/device/456');
    expect(url).toContain('bucket=a');
    expect(url).toContain('time_start=1737590400');
    expect(mockFetch.mock.calls[1][1].signal).toBeDefined();
  });

  it('caches successes and coalesces simultaneous requests', async () => {
    const results = await Promise.all([run(), run()]);
    expect(results[0].body).toBe(results[1].body);
    await run();
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('refreshes when configuration changes', async () => {
    await run();
    process.env.TEMPEST_TOKEN = 'another-private-token';
    mockFetch.mockResolvedValueOnce(response(metadata()));
    expect((await run()).statusCode).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(6);
  });

  it('expires cached successes after one hour', async () => {
    const now = Date.now();
    const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
    await run();
    clock.mockReturnValue(now + 3_600_001);
    mockFetch.mockResolvedValueOnce(response(metadata()));
    await run();
    expect(mockFetch).toHaveBeenCalledTimes(6);
    clock.mockRestore();
  });

  it('keeps the event if comparison retrieval fails and retries reference after a short cache', async () => {
    mockFetch.mockReset().mockResolvedValueOnce(response(metadata())).mockResolvedValueOnce(response(observations())).mockRejectedValueOnce(new Error('private URL'));
    const result = await run();
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toMatchObject({ comparison: null, comparisonError: expect.stringContaining('could not be retrieved') });
    expect(result.body).not.toContain('private URL');
  });

  it.each([
    { TEMPEST_TOKEN: '' }, { TEMPEST_DEVICE_ID: 'bad' }, { TEMPEST_STATION_ID: '' },
    { TEMPEST_HOST: 'attacker.example' }, { TEMPEST_HOST: '' },
  ])('rejects incomplete or unsafe configuration %j', async (override) => {
    Object.assign(process.env, override);
    expect((await run()).statusCode).toBe(503);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('normalizes the configured HTTPS host', async () => {
    process.env.TEMPEST_HOST = 'https://api.weatherflow.com/';
    expect((await run()).statusCode).toBe(200);
  });

  it.each([
    { status: { status_code: 1 } }, null, { stations: [] },
  ])('sanitizes malformed upstream station response %j', async (payload) => {
    mockFetch.mockReset().mockResolvedValue(response(payload));
    const result = await run();
    expect(result.statusCode).toBe(503);
    expect(result.body).not.toContain('test-private-token');
  });

  it('rejects an HTTP failure and permits a later retry', async () => {
    mockFetch.mockReset().mockResolvedValueOnce(response({}, false));
    expect((await run()).statusCode).toBe(503);
    mockFetch.mockResolvedValueOnce(response(metadata())).mockResolvedValue(response(observations()));
    expect((await run()).statusCode).toBe(200);
  });

  it.each(['Europe/Paris', 'UTC'])('requires station timezone to match local window semantics: %s', async (zone) => {
    const payload = metadata(); payload.stations[0].timezone = zone;
    mockFetch.mockReset().mockResolvedValue(response(payload));
    expect((await run()).statusCode).toBe(503);
  });

  it('checks device membership of the configured station', async () => {
    const payload = metadata(); payload.stations[0].devices = [];
    mockFetch.mockReset().mockResolvedValue(response(payload));
    expect((await run()).statusCode).toBe(503);
  });

  it('rejects metadata with no matching station', async () => {
    const payload = metadata(); payload.stations[0].station_id = 789;
    mockFetch.mockReset().mockResolvedValue(response(payload));
    expect((await run()).statusCode).toBe(503);
  });

  it.each([
    { status: { status_code: 0 }, type: 'obs_sky', obs: [] },
    { status: { status_code: 0 }, type: 'obs_st', obs: {} },
    { status: { status_code: 0 }, type: 'obs_st', obs: Array(10_001).fill([]) },
  ])('rejects unexpected or oversized observations', async (payload) => {
    mockFetch.mockReset().mockResolvedValueOnce(response(metadata())).mockResolvedValueOnce(response(payload));
    expect((await run()).statusCode).toBe(503);
  });

  it('does not expose network errors or aborted request URLs', async () => {
    mockFetch.mockReset().mockRejectedValue(new Error('https://private/?token=test-private-token'));
    const result = await run();
    expect(result.statusCode).toBe(503);
    expect(result.body).not.toContain('test-private-token');
  });

  it('falls back safely for missing optional station display metadata', async () => {
    const payload = metadata();
    Object.assign(payload.stations[0], { name: null, created_epoch: null });
    mockFetch.mockReset().mockResolvedValueOnce(response(payload)).mockResolvedValue(response(observations()));
    const result = JSON.parse((await run()).body);
    expect(result.station).toMatchObject({ name: 'Configured station', historySince: null });
  });
});

it('retries a missing reference after thirty seconds, not the successful one-hour cache', async () => {
  const now = Date.now();
  const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
  mockFetch.mockReset().mockResolvedValueOnce(response(metadata())).mockResolvedValueOnce(response(observations())).mockRejectedValueOnce(new Error('reference unavailable'));
  expect(JSON.parse((await run()).body).comparison).toBeNull();
  clock.mockReturnValue(now + 29_999);
  await run();
  expect(mockFetch).toHaveBeenCalledTimes(3);
  clock.mockReturnValue(now + 30_001);
  mockFetch.mockResolvedValueOnce(response(metadata())).mockResolvedValue(response(observations()));
  expect(JSON.parse((await run()).body).comparison).not.toBeNull();
  expect(mockFetch).toHaveBeenCalledTimes(6);
  clock.mockRestore();
});

it('passes a shared twenty-second abort deadline to stalled upstream calls', async () => {
  const controller = new AbortController();
  const timeout = jest.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
  mockFetch.mockReset().mockImplementation((_url: URL, options: { signal: AbortSignal }) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(new Error('Aborted credential-bearing URL')), { once: true });
  }));
  const pending = run();
  expect(timeout).toHaveBeenCalledWith(20_000);
  controller.abort();
  const result = await pending;
  expect(result.statusCode).toBe(503);
  expect(result.body).not.toContain('credential-bearing');
  timeout.mockRestore();
});

it('serializes distinct populated event and reference observations through the entire endpoint', async () => {
  const reading = (at: string, gust: number, rain: number) => {
    const row = Array(22).fill(0);
    row[0] = Date.parse(at) / 1000; row[3] = gust; row[6] = 980; row[7] = 3; row[12] = rain; row[17] = 1;
    return row;
  };
  mockFetch.mockReset().mockResolvedValueOnce(response(metadata()))
    .mockResolvedValueOnce(response({ ...observations(), obs: [reading('2025-01-24T12:00:00Z', 30, 2)] }))
    .mockResolvedValueOnce(response({ ...observations(), obs: [reading('2026-01-24T12:00:00Z', 10, 0.5)] }));
  const result = await run();
  expect(result.statusCode).toBe(200);
  const data = JSON.parse(result.body);
  expect(data.event.peakGust.mph).toBe(67.11);
  expect(data.comparison.peakGust.mph).toBe(22.37);
  expect(data.event.rainMm).toBe(2);
  expect(data.comparison.rainMm).toBe(0.5);
  expect(data.event.coverage.gust).toBeCloseTo(1 / 4320);
  expect(data.event.hourly.find((h: { minutes: number }) => h.minutes === 1)).toMatchObject({ gustMph: 67.11, rainMm: 2, coverageMinutes: { gust: 1, rain: 1 } });
});
