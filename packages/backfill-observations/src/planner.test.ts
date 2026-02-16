type CommandWithInput = {
  input: Record<string, unknown>;
};

const sendMock = jest.fn<Promise<unknown>, [CommandWithInput]>();
const s3ClientMock = jest.fn(() => ({ send: sendMock }));

class ListObjectsV2Command {
  public constructor(public readonly input: Record<string, unknown>) {}
}

class PutObjectCommand {
  public constructor(public readonly input: Record<string, unknown>) {}
}

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: s3ClientMock,
  ListObjectsV2Command,
  PutObjectCommand,
}));

describe('backfill planner', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers().setSystemTime(new Date('2026-02-16T00:00:00.000Z'));
    sendMock.mockReset();
    s3ClientMock.mockClear();
    process.env.BACKFILL_BUCKET = 'weather-tempest-records';
    process.env.BACKFILL_OUTPUT_PREFIX = 'backfill/athena-partitions';
    process.env.BACKFILL_CHUNK_SIZE = '100';
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should reject invalid chunk size', async () => {
    const { handler } = await import('./planner');

    await expect(handler({ chunkSize: -1 })).rejects.toThrow('chunkSize must be greater than zero');
  });

  it('should discover, dedupe, chunk and persist manifest', async () => {
    sendMock
      .mockResolvedValueOnce({
        Contents: [
          { Key: 'year=2024/month=08/day=05/hour=22/1722896065.json' },
          { Key: 'year=2024/month=08/day=05/hour=22/1722897000.json' },
        ],
        NextContinuationToken: 'next-page',
      })
      .mockResolvedValueOnce({
        Contents: [
          { Key: 'year=2024/month=08/day=05/hour=23/1722899665.json' },
          { Key: 'year=2024/month=08/day=06/hour=00/1722903265.json' },
        ],
      })
      .mockResolvedValue({});

    const { handler } = await import('./planner');
    const subject = await handler({ chunkSize: 2 });

    expect(subject.totalPartitions).toEqual(3);
    expect(subject.totalChunks).toEqual(2);
    expect(subject.manifestKey).toContain('backfill/athena-partitions/runs/2026-02-16T00-00-00-000Z');
    expect(sendMock).toHaveBeenCalled();

    const putCalls = sendMock.mock.calls
      .map((call) => call[0])
      .filter((command) => command instanceof PutObjectCommand);

    expect(putCalls).toHaveLength(3);
    expect(putCalls[0].input.Key).toEqual(
      'backfill/athena-partitions/runs/2026-02-16T00-00-00-000Z/chunks/chunk-00000.json',
    );
    expect(putCalls[1].input.Key).toEqual(
      'backfill/athena-partitions/runs/2026-02-16T00-00-00-000Z/chunks/chunk-00001.json',
    );
    expect(putCalls[2].input.Key).toEqual(
      'backfill/athena-partitions/runs/2026-02-16T00-00-00-000Z/manifest.json',
    );
  });
});
