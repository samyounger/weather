import { QueryExecutionState } from '@aws-sdk/client-athena';
import { Database } from '@weather/cloud-computing';
import { RefinementService } from './refinement-service';

const query = jest.fn();
const waitForQuery = jest.fn();
const getResults = jest.fn();

const database = {
  query,
  waitForQuery,
  getResults,
} as unknown as Database;

describe('RefinementService', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should skip insert when rows already exist for the date', async () => {
    query
      .mockResolvedValueOnce({ QueryExecutionId: 'create-table' })
      .mockResolvedValueOnce({ QueryExecutionId: 'existing-rows' });

    waitForQuery
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED)
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED);

    getResults.mockResolvedValue({
      ResultSet: {
        Rows: [
          { Data: [{ VarCharValue: 'refined_rows' }] },
          { Data: [{ VarCharValue: '12' }] },
        ],
      },
    });

    const subject = await new RefinementService(database).refineForDate(new Date(Date.UTC(2026, 1, 14)));

    expect(subject).toEqual({
      date: '2026-02-14',
      inserted: false,
      existingRows: 12,
    });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('should insert refined rows when no existing rows are found', async () => {
    query
      .mockResolvedValueOnce({ QueryExecutionId: 'create-table' })
      .mockResolvedValueOnce({ QueryExecutionId: 'existing-rows' })
      .mockResolvedValueOnce({ QueryExecutionId: 'insert-rows' });

    waitForQuery
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED)
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED)
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED);

    getResults.mockResolvedValue({
      ResultSet: {
        Rows: [
          { Data: [{ VarCharValue: 'refined_rows' }] },
          { Data: [{ VarCharValue: '0' }] },
        ],
      },
    });

    const subject = await new RefinementService(database).refineForDate(new Date(Date.UTC(2026, 1, 14)));

    expect(subject).toEqual({
      date: '2026-02-14',
      inserted: true,
      existingRows: 0,
    });
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('should throw when athena query does not succeed', async () => {
    query.mockResolvedValue({ QueryExecutionId: 'create-table' });
    waitForQuery.mockResolvedValue(QueryExecutionState.FAILED);

    await expect(new RefinementService(database).refineForDate(new Date(Date.UTC(2026, 1, 14))))
      .rejects
      .toThrow('Athena query failed with status: FAILED');
  });
});
