import { Database } from "@weather/cloud-computing";
import { QueryPreparation } from "./query-preparation";
import { ObservationQueries } from "../queries/observation-queries";
import { QueryExecutionState } from "@aws-sdk/client-athena";
import { OBSERVATIONS_QUERY_TARGET } from "./query-target";

jest.spyOn(ObservationQueries, 'getByDateRange').mockReturnValue('SELECT * FROM observations');

const mockQueryParams = {
  fields: ['datetime', 'winddirection'],
  from: new Date('2026-02-19T00:00:00Z'),
  to: new Date('2026-02-19T01:00:00Z'),
  fromEpochSeconds: 1771459200,
  toEpochSeconds: 1771462800,
  limit: 100,
};

const mockQueryExecutionState = jest.fn().mockReturnValue(QueryExecutionState.SUCCEEDED);
const mockQueryExecutionId = jest.fn().mockReturnValue({ QueryExecutionId: '12345' });

jest.mock('@weather/cloud-computing', () => ({
  Database: jest.fn().mockImplementation(() => {
    return {
      query: jest.fn().mockReturnValue(mockQueryExecutionId()),
      waitForQuery: jest.fn().mockReturnValue(mockQueryExecutionState()),
    };
  }),
}));

describe('QueryPreparation', () => {
  const mockDatabaseService = () => new Database();
  const service = () =>  new QueryPreparation(mockDatabaseService(), mockQueryParams, OBSERVATIONS_QUERY_TARGET);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('#valid', () => {
    let subject: boolean;

    describe('when the query is created', () => {
      beforeEach(() => {
        mockQueryExecutionId.mockReturnValue({ QueryExecutionId: '12345' });
      });

      describe('when the query succeeds', () => {
        beforeEach(async () => {
          mockQueryExecutionState.mockReturnValue(QueryExecutionState.SUCCEEDED);
          subject = await service().valid();
        });

        it('should return true', () => {
          expect(subject).toEqual(true);
        });
      });

      describe('when the query creation fails', () => {
        beforeEach(async () => {
          mockQueryExecutionState.mockReturnValue(QueryExecutionState.FAILED);
          subject = await service().valid();
        });

        it('should return false', () => {
          expect(subject).toEqual(false);
        });
      });
    });

    describe('when the query is not created', () => {
      beforeEach(async () => {
        mockQueryExecutionId.mockReturnValue({ QueryExecutionId: undefined });
        subject = await service().valid();
      });

      it('should return false', () => {
        expect(subject).toEqual(false);
      });
    });

    describe('when lambda timeout guard is configured', () => {
      it('passes stopWhen callback to waitForQuery', async () => {
        mockQueryExecutionId.mockReturnValue({ QueryExecutionId: '12345' });
        mockQueryExecutionState.mockReturnValue(QueryExecutionState.SUCCEEDED);
        const database = mockDatabaseService() as unknown as { waitForQuery: jest.Mock };
        const serviceWithTimeoutGuard = new QueryPreparation(
          database as unknown as Database,
          mockQueryParams,
          OBSERVATIONS_QUERY_TARGET,
          {
            getRemainingTimeInMillis: () => 4000,
            timeoutSafetyBufferMs: 5000,
          },
        );

        await serviceWithTimeoutGuard.valid();

        expect(database.waitForQuery).toHaveBeenCalledWith(
          '12345',
          expect.objectContaining({ stopWhen: expect.any(Function) }),
        );
        expect(database.waitForQuery.mock.calls[0][1].stopWhen()).toBe(true);
      });
    });
  });

  describe('#responseText', () => {
    let subject: string;

    const setupService = async () => {
      const svs = service();
      await svs.valid();
      subject = svs.responseText();
    };

    describe('when the query is created', () => {
      beforeEach(() => {
        mockQueryExecutionId.mockReturnValue({ QueryExecutionId: '12345' });
      });

      describe('when the query succeeds', () => {
        beforeEach(async () => {
          mockQueryExecutionState.mockReturnValue(QueryExecutionState.SUCCEEDED);
          await setupService();
        });

        it('should return true', () => {
          expect(subject).toEqual('Athena query processed successfully');
        });
      });

      describe('when the query creation fails', () => {
        beforeEach(async () => {
          mockQueryExecutionState.mockReturnValue(QueryExecutionState.FAILED);
          await setupService();
        });

        it('should return false', () => {
          expect(subject).toEqual('Failed to process Athena query');
        });
      });

      describe('when the query times out and is cancelled', () => {
        beforeEach(async () => {
          mockQueryExecutionState.mockReturnValue(QueryExecutionState.CANCELLED);
          await setupService();
        });

        it('should return timeout message', () => {
          expect(subject).toEqual('Athena query timed out and was cancelled');
        });
      });
    });

    describe('when the query is not created', () => {
      beforeEach(async () => {
        mockQueryExecutionId.mockReturnValue({ QueryExecutionId: undefined });
        await setupService();
      });

      it('should return false', () => {
        expect(subject).toEqual('Failed to execute Athena query');
      });
    });
  });
});
