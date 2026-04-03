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

  it('skips inserts when 15 minute and daily rows already exist', async () => {
    query
      .mockResolvedValueOnce({ QueryExecutionId: 'create-15m' })
      .mockResolvedValueOnce({ QueryExecutionId: 'create-daily' })
      .mockResolvedValueOnce({ QueryExecutionId: 'count-15m' })
      .mockResolvedValueOnce({ QueryExecutionId: 'count-daily' });

    waitForQuery.mockResolvedValue(QueryExecutionState.SUCCEEDED);

    getResults
      .mockResolvedValueOnce({
        ResultSet: {
          Rows: [
            { Data: [{ VarCharValue: 'refined_rows' }] },
            { Data: [{ VarCharValue: '12' }] },
          ],
        },
      })
      .mockResolvedValueOnce({
        ResultSet: {
          Rows: [
            { Data: [{ VarCharValue: 'refined_rows' }] },
            { Data: [{ VarCharValue: '1' }] },
          ],
        },
      });

    const subject = await new RefinementService(database).refineForDate(new Date(Date.UTC(2026, 1, 14)));

    expect(subject).toEqual({
      date: '2026-02-14',
      fifteenMinuteInserted: 0,
      fifteenMinuteExistingRows: 12,
      dailyInserted: 0,
      dailyExistingRows: 1,
    });
  });

  it('inserts refined rows when no existing rows are found', async () => {
    query
      .mockResolvedValueOnce({ QueryExecutionId: 'create-15m' })
      .mockResolvedValueOnce({ QueryExecutionId: 'create-daily' })
      .mockResolvedValueOnce({ QueryExecutionId: 'count-15m' })
      .mockResolvedValueOnce({ QueryExecutionId: 'count-daily' })
      .mockResolvedValueOnce({ QueryExecutionId: 'insert-15m' })
      .mockResolvedValueOnce({ QueryExecutionId: 'count-15m-after' })
      .mockResolvedValueOnce({ QueryExecutionId: 'insert-daily' })
      .mockResolvedValueOnce({ QueryExecutionId: 'count-daily-after' });

    waitForQuery.mockResolvedValue(QueryExecutionState.SUCCEEDED);

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
      })
      .mockResolvedValueOnce({
        ResultSet: {
          Rows: [
            { Data: [{ VarCharValue: 'refined_rows' }] },
            { Data: [{ VarCharValue: '1' }] },
          ],
        },
      });

    const subject = await new RefinementService(database).refineForDate(new Date(Date.UTC(2026, 1, 14)));

    expect(subject).toEqual({
      date: '2026-02-14',
      fifteenMinuteInserted: 96,
      fifteenMinuteExistingRows: 0,
      dailyInserted: 1,
      dailyExistingRows: 0,
    });
  });

  it('throws when athena query does not succeed', async () => {
    query.mockResolvedValue({ QueryExecutionId: 'create-table' });
    waitForQuery.mockResolvedValue(QueryExecutionState.FAILED);

    await expect(new RefinementService(database).refineForDate(new Date(Date.UTC(2026, 1, 14))))
      .rejects
      .toThrow('Athena query failed with status: FAILED');
  });

  it('refines for yesterday using the current UTC date', async () => {
    jest.useFakeTimers().setSystemTime(new Date(Date.UTC(2026, 1, 15, 10, 0, 0)));

    query
      .mockResolvedValueOnce({ QueryExecutionId: 'create-15m' })
      .mockResolvedValueOnce({ QueryExecutionId: 'create-daily' })
      .mockResolvedValueOnce({ QueryExecutionId: 'count-15m' })
      .mockResolvedValueOnce({ QueryExecutionId: 'count-daily' })
      .mockResolvedValueOnce({ QueryExecutionId: 'insert-15m' })
      .mockResolvedValueOnce({ QueryExecutionId: 'count-15m-after' })
      .mockResolvedValueOnce({ QueryExecutionId: 'insert-daily' })
      .mockResolvedValueOnce({ QueryExecutionId: 'count-daily-after' });

    waitForQuery.mockResolvedValue(QueryExecutionState.SUCCEEDED);
    getResults
      .mockResolvedValueOnce({
        ResultSet: { Rows: [{ Data: [{ VarCharValue: 'refined_rows' }] }, { Data: [{ VarCharValue: '0' }] }] },
      })
      .mockResolvedValueOnce({
        ResultSet: { Rows: [{ Data: [{ VarCharValue: 'refined_rows' }] }, { Data: [{ VarCharValue: '0' }] }] },
      })
      .mockResolvedValueOnce({
        ResultSet: { Rows: [{ Data: [{ VarCharValue: 'refined_rows' }] }, { Data: [{ VarCharValue: '96' }] }] },
      })
      .mockResolvedValueOnce({
        ResultSet: { Rows: [{ Data: [{ VarCharValue: 'refined_rows' }] }, { Data: [{ VarCharValue: '1' }] }] },
      });

    const subject = await new RefinementService(database).refineForYesterday();

    expect(subject.date).toEqual('2026-02-14');
    jest.useRealTimers();
  });

  it('throws when create table query response has no id', async () => {
    query.mockResolvedValueOnce({});

    await expect(new RefinementService(database).refineForDate(new Date(Date.UTC(2026, 1, 14))))
      .rejects
      .toThrow('Failed to execute Athena query');
  });

  it('throws when count query response has no id', async () => {
    query
      .mockResolvedValueOnce({ QueryExecutionId: 'create-15m' })
      .mockResolvedValueOnce({ QueryExecutionId: 'create-daily' })
      .mockResolvedValueOnce({});

    waitForQuery
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED)
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED);

    await expect(new RefinementService(database).refineForDate(new Date(Date.UTC(2026, 1, 14))))
      .rejects
      .toThrow('Failed to execute Athena query');
  });

  it('throws when a count query execution does not succeed', async () => {
    query
      .mockResolvedValueOnce({ QueryExecutionId: 'create-15m' })
      .mockResolvedValueOnce({ QueryExecutionId: 'create-daily' })
      .mockResolvedValueOnce({ QueryExecutionId: 'count-15m' });

    waitForQuery
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED)
      .mockResolvedValueOnce(QueryExecutionState.SUCCEEDED)
      .mockResolvedValueOnce(QueryExecutionState.CANCELLED);

    await expect(new RefinementService(database).refineForDate(new Date(Date.UTC(2026, 1, 14))))
      .rejects
      .toThrow('Athena query failed with status: CANCELLED');
  });

  it('treats missing count rows as zero', async () => {
    query
      .mockResolvedValueOnce({ QueryExecutionId: 'create-15m' })
      .mockResolvedValueOnce({ QueryExecutionId: 'create-daily' })
      .mockResolvedValueOnce({ QueryExecutionId: 'count-15m' })
      .mockResolvedValueOnce({ QueryExecutionId: 'count-daily' })
      .mockResolvedValueOnce({ QueryExecutionId: 'insert-15m' })
      .mockResolvedValueOnce({ QueryExecutionId: 'count-15m-after' })
      .mockResolvedValueOnce({ QueryExecutionId: 'insert-daily' })
      .mockResolvedValueOnce({ QueryExecutionId: 'count-daily-after' });

    waitForQuery.mockResolvedValue(QueryExecutionState.SUCCEEDED);
    getResults
      .mockResolvedValueOnce({ ResultSet: { Rows: [{ Data: [{ VarCharValue: 'refined_rows' }] }] } })
      .mockResolvedValueOnce({ ResultSet: { Rows: [{ Data: [{ VarCharValue: 'refined_rows' }] }] } })
      .mockResolvedValueOnce({ ResultSet: { Rows: [{ Data: [{ VarCharValue: 'refined_rows' }] }] } })
      .mockResolvedValueOnce({ ResultSet: { Rows: [{ Data: [{ VarCharValue: 'refined_rows' }] }] } });

    const subject = await new RefinementService(database).refineForDate(new Date(Date.UTC(2026, 1, 14)));

    expect(subject.fifteenMinuteInserted).toBe(0);
    expect(subject.dailyInserted).toBe(0);
  });

  it('treats missing or non-numeric count values as zero', async () => {
    query
      .mockResolvedValueOnce({ QueryExecutionId: 'create-15m' })
      .mockResolvedValueOnce({ QueryExecutionId: 'create-daily' })
      .mockResolvedValueOnce({ QueryExecutionId: 'count-15m' })
      .mockResolvedValueOnce({ QueryExecutionId: 'count-daily' })
      .mockResolvedValueOnce({ QueryExecutionId: 'insert-15m' })
      .mockResolvedValueOnce({ QueryExecutionId: 'count-15m-after' })
      .mockResolvedValueOnce({ QueryExecutionId: 'insert-daily' })
      .mockResolvedValueOnce({ QueryExecutionId: 'count-daily-after' });

    waitForQuery.mockResolvedValue(QueryExecutionState.SUCCEEDED);
    getResults
      .mockResolvedValueOnce({
        ResultSet: { Rows: [{ Data: [{ VarCharValue: 'refined_rows' }] }, { Data: [{ VarCharValue: 'abc' }] }] },
      })
      .mockResolvedValueOnce({
        ResultSet: { Rows: [{ Data: [{ VarCharValue: 'refined_rows' }] }, { Data: [{}] }] },
      })
      .mockResolvedValueOnce({
        ResultSet: { Rows: [{ Data: [{ VarCharValue: 'refined_rows' }] }, { Data: [{ VarCharValue: 'abc' }] }] },
      })
      .mockResolvedValueOnce({
        ResultSet: { Rows: [{ Data: [{ VarCharValue: 'refined_rows' }] }, { Data: [{}] }] },
      });

    const subject = await new RefinementService(database).refineForDate(new Date(Date.UTC(2026, 1, 14)));

    expect(subject.fifteenMinuteInserted).toBe(0);
    expect(subject.dailyInserted).toBe(0);
  });
});
