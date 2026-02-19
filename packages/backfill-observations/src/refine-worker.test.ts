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

class GetQueryResultsCommand {
  public constructor(public readonly input: Record<string, unknown>) {}
}

class GetObjectCommand {
  public constructor(public readonly input: Record<string, unknown>) {}
}

jest.mock('@aws-sdk/client-athena', () => ({
  AthenaClient: athenaClientMock,
  StartQueryExecutionCommand,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  QueryExecutionState,
}));

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: s3ClientMock,
  GetObjectCommand,
}));

describe('refine backfill worker', () => {
  beforeEach(() => {
    jest.resetModules();
    athenaSendMock.mockReset();
    s3SendMock.mockReset();
    athenaClientMock.mockClear();
    s3ClientMock.mockClear();
    process.env.BACKFILL_POLL_DELAY_MS = '0';
    process.env.BACKFILL_MAX_POLLS = '120';
  });

  it('should throw when chunk payload is missing', async () => {
    s3SendMock.mockResolvedValueOnce({});

    const { handler } = await import('./refine-worker');

    await expect(handler({
      bucket: 'weather-tempest-records',
      chunkKey: 'backfill/refined-15m/runs/test/chunks/chunk-00000.json',
    })).rejects.toThrow('Missing chunk payload for backfill/refined-15m/runs/test/chunks/chunk-00000.json');
  });

  it('should process chunk dates and insert refined rows', async () => {
    s3SendMock.mockResolvedValueOnce({
      Body: Readable.from([JSON.stringify(['2024-08-05'])]),
    });

    athenaSendMock
      .mockResolvedValueOnce({ QueryExecutionId: 'query-create' })
      .mockResolvedValueOnce({ QueryExecution: { Status: { State: QueryExecutionState.SUCCEEDED } } })
      .mockResolvedValueOnce({ QueryExecutionId: 'query-existing-1' })
      .mockResolvedValueOnce({ QueryExecution: { Status: { State: QueryExecutionState.SUCCEEDED } } })
      .mockResolvedValueOnce({ ResultSet: { Rows: [{ Data: [{ VarCharValue: 'refined_rows' }] }, { Data: [{ VarCharValue: '0' }] }] } })
      .mockResolvedValueOnce({ QueryExecutionId: 'query-insert' })
      .mockResolvedValueOnce({ QueryExecution: { Status: { State: QueryExecutionState.SUCCEEDED } } })
      .mockResolvedValueOnce({ QueryExecutionId: 'query-existing-2' })
      .mockResolvedValueOnce({ QueryExecution: { Status: { State: QueryExecutionState.SUCCEEDED } } })
      .mockResolvedValueOnce({ ResultSet: { Rows: [{ Data: [{ VarCharValue: 'refined_rows' }] }, { Data: [{ VarCharValue: '96' }] }] } });

    const { handler } = await import('./refine-worker');
    const subject = await handler({
      bucket: 'weather-tempest-records',
      chunkKey: 'backfill/refined-15m/runs/test/chunks/chunk-00000.json',
    });

    expect(subject).toEqual({
      bucket: 'weather-tempest-records',
      chunkKey: 'backfill/refined-15m/runs/test/chunks/chunk-00000.json',
      attemptedDates: 1,
      succeededDates: 1,
      skippedDates: 0,
      failedDates: 0,
      insertedRows: 96,
    });

    const createTableCommand = athenaSendMock.mock.calls[0][0] as StartQueryExecutionCommand;
    expect(createTableCommand.input.QueryString).toContain('CREATE EXTERNAL TABLE IF NOT EXISTS observations_refined_15m');

    const insertCommand = athenaSendMock.mock.calls[5][0] as StartQueryExecutionCommand;
    expect(insertCommand.input.QueryString).toContain("INSERT INTO observations_refined_15m");
    expect(insertCommand.input.QueryString).toContain("WHERE year='2024'");
    expect(insertCommand.input.QueryString).toContain("AND month='08'");
    expect(insertCommand.input.QueryString).toContain("AND day='05'");
  });

  it('should skip dates that are already refined', async () => {
    s3SendMock.mockResolvedValueOnce({
      Body: Readable.from([JSON.stringify(['2024-08-05'])]),
    });

    athenaSendMock
      .mockResolvedValueOnce({ QueryExecutionId: 'query-create' })
      .mockResolvedValueOnce({ QueryExecution: { Status: { State: QueryExecutionState.SUCCEEDED } } })
      .mockResolvedValueOnce({ QueryExecutionId: 'query-existing-1' })
      .mockResolvedValueOnce({ QueryExecution: { Status: { State: QueryExecutionState.SUCCEEDED } } })
      .mockResolvedValueOnce({ ResultSet: { Rows: [{ Data: [{ VarCharValue: 'refined_rows' }] }, { Data: [{ VarCharValue: '96' }] }] } });

    const { handler } = await import('./refine-worker');
    const subject = await handler({
      bucket: 'weather-tempest-records',
      chunkKey: 'backfill/refined-15m/runs/test/chunks/chunk-00000.json',
    });

    expect(subject).toEqual({
      bucket: 'weather-tempest-records',
      chunkKey: 'backfill/refined-15m/runs/test/chunks/chunk-00000.json',
      attemptedDates: 1,
      succeededDates: 1,
      skippedDates: 1,
      failedDates: 0,
      insertedRows: 0,
    });
  });
});
