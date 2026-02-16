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
      inserted: 0,
      existingRows: 12,
    });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('should insert refined rows when no existing rows are found', async () => {
    query
      .mockResolvedValueOnce({ QueryExecutionId: 'create-table' })
      .mockResolvedValueOnce({ QueryExecutionId: 'existing-rows' })
      .mockResolvedValueOnce({ QueryExecutionId: 'insert-rows' })
      .mockResolvedValueOnce({ QueryExecutionId: 'existing-rows-after-insert' });

    waitForQuery
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED)
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED)
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED)
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED);

    getResults
      .mockResolvedValueOnce({
        ResultSet: {
          Rows: [
            { Data: [{ VarCharValue: 'refined_rows' }] },
            { Data: [{ VarCharValue: '0' }] },
          ],
        },
      })
      .mockResolvedValueOnce({
        ResultSet: {
          Rows: [
            { Data: [{ VarCharValue: 'refined_rows' }] },
            { Data: [{ VarCharValue: '96' }] },
          ],
        },
      });

    const subject = await new RefinementService(database).refineForDate(new Date(Date.UTC(2026, 1, 14)));

    expect(subject).toEqual({
      date: '2026-02-14',
      inserted: 96,
      existingRows: 0,
    });
    expect(query).toHaveBeenCalledTimes(4);
  });

  it('should throw when athena query does not succeed', async () => {
    query.mockResolvedValue({ QueryExecutionId: 'create-table' });
    waitForQuery.mockResolvedValue(QueryExecutionState.FAILED);

    await expect(new RefinementService(database).refineForDate(new Date(Date.UTC(2026, 1, 14))))
      .rejects
      .toThrow('Athena query failed with status: FAILED');
  });

  it('should refine for yesterday using current UTC date', async () => {
    jest.useFakeTimers().setSystemTime(new Date(Date.UTC(2026, 1, 15, 10, 0, 0)));

    query
      .mockResolvedValueOnce({ QueryExecutionId: 'create-table' })
      .mockResolvedValueOnce({ QueryExecutionId: 'existing-rows' })
      .mockResolvedValueOnce({ QueryExecutionId: 'insert-rows' })
      .mockResolvedValueOnce({ QueryExecutionId: 'existing-rows-after-insert' });

    waitForQuery
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED)
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED)
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED)
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED);

    getResults
      .mockResolvedValueOnce({
        ResultSet: {
          Rows: [
            { Data: [{ VarCharValue: 'refined_rows' }] },
            { Data: [{ VarCharValue: '0' }] },
          ],
        },
      })
      .mockResolvedValueOnce({
        ResultSet: {
          Rows: [
            { Data: [{ VarCharValue: 'refined_rows' }] },
            { Data: [{ VarCharValue: '96' }] },
          ],
        },
      });

    const subject = await new RefinementService(database).refineForYesterday();

    expect(subject.date).toEqual('2026-02-14');
    expect(subject.inserted).toEqual(96);
    jest.useRealTimers();
  });

  it('should throw when create table query response has no id', async () => {
    query.mockResolvedValueOnce({});

    await expect(new RefinementService(database).refineForDate(new Date(Date.UTC(2026, 1, 14))))
      .rejects
      .toThrow('Failed to execute Athena query');
  });

  it('should throw when existing row query response has no id', async () => {
    query
      .mockResolvedValueOnce({ QueryExecutionId: 'create-table' })
      .mockResolvedValueOnce({});

    waitForQuery.mockResolvedValueOnce(QueryExecutionState.SUCCEEDED);

    await expect(new RefinementService(database).refineForDate(new Date(Date.UTC(2026, 1, 14))))
      .rejects
      .toThrow('Failed to execute Athena query');
  });

  it('should throw when existing row query execution fails', async () => {
    query
      .mockResolvedValueOnce({ QueryExecutionId: 'create-table' })
      .mockResolvedValueOnce({ QueryExecutionId: 'existing-rows' });

    waitForQuery
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED)
      .mockResolvedValueOnce(QueryExecutionState.CANCELLED);

    await expect(new RefinementService(database).refineForDate(new Date(Date.UTC(2026, 1, 14))))
      .rejects
      .toThrow('Athena query failed with status: CANCELLED');
  });

  it('should treat missing count result rows as zero and insert', async () => {
    query
      .mockResolvedValueOnce({ QueryExecutionId: 'create-table' })
      .mockResolvedValueOnce({ QueryExecutionId: 'existing-rows' })
      .mockResolvedValueOnce({ QueryExecutionId: 'insert-rows' })
      .mockResolvedValueOnce({ QueryExecutionId: 'existing-rows-after-insert' });

    waitForQuery
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED)
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED)
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED)
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED);

    getResults
      .mockResolvedValueOnce({
        ResultSet: {
          Rows: [{ Data: [{ VarCharValue: 'refined_rows' }] }],
        },
      })
      .mockResolvedValueOnce({
        ResultSet: {
          Rows: [{ Data: [{ VarCharValue: 'refined_rows' }] }],
        },
      });

    const subject = await new RefinementService(database).refineForDate(new Date(Date.UTC(2026, 1, 14)));

    expect(subject).toEqual({
      date: '2026-02-14',
      inserted: 0,
      existingRows: 0,
    });
  });

  it('should treat non-numeric count value as zero and insert', async () => {
    query
      .mockResolvedValueOnce({ QueryExecutionId: 'create-table' })
      .mockResolvedValueOnce({ QueryExecutionId: 'existing-rows' })
      .mockResolvedValueOnce({ QueryExecutionId: 'insert-rows' })
      .mockResolvedValueOnce({ QueryExecutionId: 'existing-rows-after-insert' });

    waitForQuery
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED)
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED)
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED)
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED);

    getResults
      .mockResolvedValueOnce({
        ResultSet: {
          Rows: [
            { Data: [{ VarCharValue: 'refined_rows' }] },
            { Data: [{ VarCharValue: 'abc' }] },
          ],
        },
      })
      .mockResolvedValueOnce({
        ResultSet: {
          Rows: [
            { Data: [{ VarCharValue: 'refined_rows' }] },
            { Data: [{ VarCharValue: 'abc' }] },
          ],
        },
      });

    const subject = await new RefinementService(database).refineForDate(new Date(Date.UTC(2026, 1, 14)));

    expect(subject).toEqual({
      date: '2026-02-14',
      inserted: 0,
      existingRows: 0,
    });
  });

  it('should treat missing count cell value as zero and insert', async () => {
    query
      .mockResolvedValueOnce({ QueryExecutionId: 'create-table' })
      .mockResolvedValueOnce({ QueryExecutionId: 'existing-rows' })
      .mockResolvedValueOnce({ QueryExecutionId: 'insert-rows' })
      .mockResolvedValueOnce({ QueryExecutionId: 'existing-rows-after-insert' });

    waitForQuery
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED)
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED)
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED)
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED);

    getResults
      .mockResolvedValueOnce({
        ResultSet: {
          Rows: [
            { Data: [{ VarCharValue: 'refined_rows' }] },
            { Data: [{}] },
          ],
        },
      })
      .mockResolvedValueOnce({
        ResultSet: {
          Rows: [
            { Data: [{ VarCharValue: 'refined_rows' }] },
            { Data: [{}] },
          ],
        },
      });

    const subject = await new RefinementService(database).refineForDate(new Date(Date.UTC(2026, 1, 14)));

    expect(subject).toEqual({
      date: '2026-02-14',
      inserted: 0,
      existingRows: 0,
    });
  });
});
