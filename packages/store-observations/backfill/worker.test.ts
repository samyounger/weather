import { Readable } from 'node:stream';

type CommandWithInput = {
  input: Record<string, unknown>;
};

const athenaSendMock = jest.fn<Promise<unknown>, [CommandWithInput]>();
const s3SendMock = jest.fn<Promise<unknown>, [CommandWithInput]>();
const athenaClientMock = jest.fn(() => ({ send: athenaSendMock }));
const s3ClientMock = jest.fn(() => ({ send: s3SendMock }));

const QueryExecutionState = {
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  RUNNING: 'RUNNING',
} as const;

class StartQueryExecutionCommand {
  public constructor(public readonly input: Record<string, unknown>) {}
}

class GetQueryExecutionCommand {
  public constructor(public readonly input: Record<string, unknown>) {}
}

class GetObjectCommand {
  public constructor(public readonly input: Record<string, unknown>) {}
}

jest.mock('@aws-sdk/client-athena', () => ({
  AthenaClient: athenaClientMock,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  QueryExecutionState,
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: s3ClientMock,
  GetObjectCommand,
}));

describe('backfill worker', () => {
  beforeEach(() => {
    jest.resetModules();
    athenaSendMock.mockReset();
    s3SendMock.mockReset();
    athenaClientMock.mockClear();
    s3ClientMock.mockClear();
    process.env.BACKFILL_POLL_DELAY_MS = '0';
  });

  it('should process a chunk and add partitions in athena', async () => {
    s3SendMock.mockResolvedValueOnce({
      Body: Readable.from([JSON.stringify([
        { year: '2024', month: '08', day: '05', hour: '22' },
        { year: '2024', month: '08', day: '05', hour: '23' },
      ])]),
    });

    athenaSendMock
      .mockResolvedValueOnce({ QueryExecutionId: 'query-123' })
      .mockResolvedValueOnce({
        QueryExecution: {
          Status: { State: QueryExecutionState.SUCCEEDED },
        },
      });

    const { handler } = await import('./worker');
    const subject = await handler({
      bucket: 'weather-tempest-records',
      chunkKey: 'backfill/athena-partitions/runs/test/chunks/chunk-00000.json',
    });

    expect(subject).toEqual({
      bucket: 'weather-tempest-records',
      chunkKey: 'backfill/athena-partitions/runs/test/chunks/chunk-00000.json',
      attempted: 2,
      succeeded: 2,
      failed: 0,
      queryExecutionId: 'query-123',
      queryState: QueryExecutionState.SUCCEEDED,
    });

    const startCommand = athenaSendMock.mock.calls[0][0] as StartQueryExecutionCommand;
    expect(startCommand.input.QueryString).toEqual(
      "ALTER TABLE observations ADD IF NOT EXISTS\nPARTITION (year='2024', month='08', day='05', hour='22') LOCATION 's3://weather-tempest-records/year=2024/month=08/day=05/hour=22/'\nPARTITION (year='2024', month='08', day='05', hour='23') LOCATION 's3://weather-tempest-records/year=2024/month=08/day=05/hour=23/';",
    );
  });

  it('should throw when athena query does not return an id', async () => {
    s3SendMock.mockResolvedValueOnce({
      Body: Readable.from([JSON.stringify([{ year: '2024', month: '08', day: '05', hour: '22' }])]),
    });
    athenaSendMock.mockResolvedValueOnce({});

    const { handler } = await import('./worker');

    await expect(handler({
      bucket: 'weather-tempest-records',
      chunkKey: 'backfill/athena-partitions/runs/test/chunks/chunk-00000.json',
    })).rejects.toThrow('Failed to start Athena query');
  });

  it('should throw when athena query fails', async () => {
    s3SendMock.mockResolvedValueOnce({
      Body: Readable.from([JSON.stringify([{ year: '2024', month: '08', day: '05', hour: '22' }])]),
    });
    athenaSendMock
      .mockResolvedValueOnce({ QueryExecutionId: 'query-123' })
      .mockResolvedValueOnce({
        QueryExecution: {
          Status: { State: QueryExecutionState.FAILED },
        },
      });

    const { handler } = await import('./worker');

    await expect(handler({
      bucket: 'weather-tempest-records',
      chunkKey: 'backfill/athena-partitions/runs/test/chunks/chunk-00000.json',
    })).rejects.toThrow('Athena query query-123 failed with state: FAILED');
  });
});
