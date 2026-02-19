import { QueryExecutionState } from "@aws-sdk/client-athena";
import { AthenaClient } from "@aws-sdk/client-athena";
import { databaseClient } from "./client";
import { Database } from "./database";

jest.mock('./client', () => ({
  databaseClient: jest.fn(),
}));

describe('Database core methods', () => {
  const send = jest.fn();
  const databaseClientMock = databaseClient as jest.MockedFunction<typeof databaseClient>;

  beforeEach(() => {
    send.mockReset();
    databaseClientMock.mockReset();
    databaseClientMock.mockResolvedValue({ send } as unknown as AthenaClient);
  });

  describe('query', () => {
    it('should execute a start query command', async () => {
      send.mockResolvedValue({ QueryExecutionId: 'query-123' });

      const subject = await new Database().query('SELECT 1');

      expect(subject).toEqual({ QueryExecutionId: 'query-123' });
      expect(send.mock.calls[0][0].input).toMatchObject({
        QueryString: 'SELECT 1',
        QueryExecutionContext: {
          Database: 'tempest_weather',
          Catalog: 'AwsDataCatalog',
        },
        ResultConfiguration: {
          OutputLocation: 's3://weather-tempest-records/queries/',
        },
        WorkGroup: 'primary',
      });
    });
  });

  describe('getResults', () => {
    it('should execute a get results command', async () => {
      send.mockResolvedValue({ ResultSet: { Rows: [] } });

      const subject = await new Database().getResults('query-123');

      expect(subject).toEqual({ ResultSet: { Rows: [] } });
      expect(send.mock.calls[0][0].input).toEqual({
        QueryExecutionId: 'query-123',
      });
    });
  });

  describe('waitForQuery', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should return immediately when query succeeds', async () => {
      const database = new Database();
      jest.spyOn(database as unknown as { queryStatus: () => Promise<QueryExecutionState> }, 'queryStatus')
        .mockResolvedValue(QueryExecutionState.SUCCEEDED);

      await expect(database.waitForQuery('query-123')).resolves.toEqual(QueryExecutionState.SUCCEEDED);
    });

    it('should poll until query reaches a terminal state', async () => {
      const database = new Database();
      jest.spyOn(database as unknown as { queryStatus: () => Promise<QueryExecutionState> }, 'queryStatus')
        .mockResolvedValueOnce(QueryExecutionState.RUNNING)
        .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED);

      const subject = database.waitForQuery('query-123');
      await jest.advanceTimersByTimeAsync(2000);

      await expect(subject).resolves.toEqual(QueryExecutionState.SUCCEEDED);
    });

    it('should stop polling after max query count', async () => {
      const database = new Database();
      jest.spyOn(database as unknown as { queryStatus: () => Promise<QueryExecutionState> }, 'queryStatus')
        .mockResolvedValue(QueryExecutionState.RUNNING);

      const subject = database.waitForQuery('query-123');
      await jest.advanceTimersByTimeAsync(2000 * 121);

      await expect(subject).resolves.toEqual(QueryExecutionState.RUNNING);
    });

    it('should cancel query when stopWhen returns true', async () => {
      const database = new Database();
      const cancelSpy = jest.spyOn(database, 'cancelQuery').mockResolvedValue();

      await expect(database.waitForQuery('query-123', { stopWhen: () => true })).resolves.toEqual(QueryExecutionState.CANCELLED);
      expect(cancelSpy).toHaveBeenCalledWith('query-123');
    });

    it('should cancel query when max wait is reached', async () => {
      const database = new Database();
      const cancelSpy = jest.spyOn(database, 'cancelQuery').mockResolvedValue();
      jest.spyOn(database as unknown as { queryStatus: () => Promise<QueryExecutionState> }, 'queryStatus')
        .mockResolvedValue(QueryExecutionState.RUNNING);
      const nowSpy = jest.spyOn(Date, 'now')
        .mockReturnValueOnce(1000)
        .mockReturnValueOnce(1002);

      const subject = database.waitForQuery('query-123', { maxWaitMs: 1 });
      await jest.advanceTimersByTimeAsync(2000);

      await expect(subject).resolves.toEqual(QueryExecutionState.CANCELLED);
      expect(cancelSpy).toHaveBeenCalledWith('query-123');
      nowSpy.mockRestore();
    });
  });

  describe('cancelQuery', () => {
    it('should swallow stop query errors', async () => {
      send.mockRejectedValue(new Error('stop failed'));
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      const database = new Database();

      await expect(database.cancelQuery('query-123')).resolves.toBeUndefined();
      expect(errorSpy).toHaveBeenCalledWith('Failed to cancel Athena query', expect.objectContaining({ queryExecutionId: 'query-123' }));
      errorSpy.mockRestore();
    });
  });

  describe('getQueryState', () => {
    it('should return current query state', async () => {
      send.mockResolvedValue({
        QueryExecution: {
          Status: {
            State: QueryExecutionState.RUNNING,
          },
        },
      });
      const database = new Database();

      await expect(database.getQueryState('query-123')).resolves.toEqual(QueryExecutionState.RUNNING);
    });
  });

  describe('queryStatus', () => {
    it('should return query execution state', async () => {
      send.mockResolvedValue({
        QueryExecution: {
          Status: {
            State: QueryExecutionState.SUCCEEDED,
          },
        },
      });
      const database = new Database();

      await expect((database as unknown as { queryStatus: (queryExecutionId: string) => Promise<QueryExecutionState> }).queryStatus('query-123'))
        .resolves
        .toEqual(QueryExecutionState.SUCCEEDED);
    });

    it('should throw when query execution is missing', async () => {
      send.mockResolvedValue({});
      const database = new Database();

      await expect((database as unknown as { queryStatus: (queryExecutionId: string) => Promise<QueryExecutionState> }).queryStatus('query-123'))
        .rejects
        .toThrow('Query execution not found');
    });

    it('should throw when query execution status is missing', async () => {
      send.mockResolvedValue({ QueryExecution: {} });
      const database = new Database();

      await expect((database as unknown as { queryStatus: (queryExecutionId: string) => Promise<QueryExecutionState> }).queryStatus('query-123'))
        .rejects
        .toThrow('Query execution status not found');
    });
  });
});
