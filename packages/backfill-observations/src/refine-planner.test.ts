type RefineCommandWithInput = {
  input: Record<string, unknown>;
};

const refineSendMock = jest.fn<Promise<unknown>, [RefineCommandWithInput]>();
const refineS3ClientMock = jest.fn(() => ({ send: refineSendMock }));

class RefinePutObjectCommand {
  public constructor(public readonly input: Record<string, unknown>) {}
}

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: refineS3ClientMock,
  PutObjectCommand: RefinePutObjectCommand,
}));

describe('refine backfill planner', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers().setSystemTime(new Date('2026-02-19T00:00:00.000Z'));
    refineSendMock.mockReset();
    refineS3ClientMock.mockClear();
    process.env.BACKFILL_BUCKET = 'weather-tempest-records';
    process.env.BACKFILL_REFINED_OUTPUT_PREFIX = 'backfill/refined-15m';
    process.env.BACKFILL_REFINED_CHUNK_SIZE = '2';
    delete process.env.BACKFILL_REFINED_START_DATE;
    delete process.env.BACKFILL_REFINED_END_DATE;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should reject when startDate is missing', async () => {
    const { handler } = await import('./refine-planner');

    await expect(handler({})).rejects.toThrow('startDate is required (event.startDate or BACKFILL_REFINED_START_DATE)');
  });

  it('should reject invalid chunk size', async () => {
    const { handler } = await import('./refine-planner');

    await expect(handler({ startDate: '2026-02-16', endDate: '2026-02-17', chunkSize: 0 })).rejects.toThrow(
      'chunkSize must be greater than zero',
    );
  });

  it('should reject invalid startDate format', async () => {
    const { handler } = await import('./refine-planner');

    await expect(handler({ startDate: '20260216', endDate: '2026-02-17' })).rejects.toThrow(
      'startDate must use YYYY-MM-DD format',
    );
  });

  it('should reject when startDate is after endDate', async () => {
    const { handler } = await import('./refine-planner');

    await expect(handler({ startDate: '2026-02-18', endDate: '2026-02-17' })).rejects.toThrow(
      'startDate must be less than or equal to endDate',
    );
  });

  it('should enumerate dates, chunk, and persist manifest', async () => {
    refineSendMock.mockResolvedValue({});

    const { handler } = await import('./refine-planner');
    const subject = await handler({ startDate: '2026-02-16', endDate: '2026-02-19', chunkSize: 2 });

    expect(subject.totalDates).toEqual(4);
    expect(subject.totalChunks).toEqual(2);
    expect(subject.chunkKeys).toEqual([
      'backfill/refined-15m/runs/2026-02-19T00-00-00-000Z/chunks/chunk-00000.json',
      'backfill/refined-15m/runs/2026-02-19T00-00-00-000Z/chunks/chunk-00001.json',
    ]);
    expect(subject.manifestKey).toEqual('backfill/refined-15m/runs/2026-02-19T00-00-00-000Z/manifest.json');

    const putCalls = refineSendMock.mock.calls
      .map((call) => call[0])
      .filter((command) => command instanceof RefinePutObjectCommand);

    expect(putCalls).toHaveLength(3);
    expect(putCalls[0].input.Key).toEqual('backfill/refined-15m/runs/2026-02-19T00-00-00-000Z/chunks/chunk-00000.json');
    expect(putCalls[1].input.Key).toEqual('backfill/refined-15m/runs/2026-02-19T00-00-00-000Z/chunks/chunk-00001.json');
    expect(putCalls[2].input.Key).toEqual('backfill/refined-15m/runs/2026-02-19T00-00-00-000Z/manifest.json');
  });

  it('should use env defaults and include maxConcurrency when provided', async () => {
    process.env.BACKFILL_REFINED_START_DATE = '2026-02-16';
    process.env.BACKFILL_REFINED_END_DATE = '2026-02-17';
    refineSendMock.mockResolvedValue({});

    const { handler } = await import('./refine-planner');
    const subject = await handler({ maxConcurrency: 5 });

    expect(subject.maxConcurrency).toBe(5);
    expect(subject.startDate).toBe('2026-02-16');
    expect(subject.endDate).toBe('2026-02-17');
    expect(subject.totalDates).toBe(2);
  });
});
