import { GetQueryResultsOutput, QueryExecutionState } from '@aws-sdk/client-athena';
import { Database, partitionDatePartsUtc } from '@weather/cloud-computing';
import { RefinementQueries } from './refinement-queries';

export type RefinementSummary = {
  date: string;
  fifteenMinuteInserted: number;
  fifteenMinuteExistingRows: number;
  dailyInserted: number;
  dailyExistingRows: number;
};

export class RefinementService {
  public constructor(private readonly database: Database) {}

  public async refineForYesterday(): Promise<RefinementSummary> {
    const targetDate = this.yesterdayUtc();

    return await this.refineForDate(targetDate);
  }

  public async refineForDate(targetDate: Date): Promise<RefinementSummary> {
    const { year, month, day } = partitionDatePartsUtc(targetDate);
    const parts = { year, month, day };

    await this.executeQuery(RefinementQueries.createRefinedTable());
    await this.executeQuery(RefinementQueries.createDailyRefinedTable());

    const fifteenMinuteExistingRows = await this.querySingleNumericResult(RefinementQueries.existingRowsForDate(parts));
    const dailyExistingRows = await this.querySingleNumericResult(RefinementQueries.existingDailyRowsForDate(parts));

    const fifteenMinuteInserted = await this.insertIfMissing({
      existingRows: fifteenMinuteExistingRows,
      insertQuery: RefinementQueries.insertRefinedRowsForDate(parts),
      countQuery: RefinementQueries.existingRowsForDate(parts),
    });

    const dailyInserted = await this.insertIfMissing({
      existingRows: dailyExistingRows,
      insertQuery: RefinementQueries.insertDailyRefinedRowsForDate(parts),
      countQuery: RefinementQueries.existingDailyRowsForDate(parts),
    });

    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      fifteenMinuteInserted,
      fifteenMinuteExistingRows,
      dailyInserted,
      dailyExistingRows,
    };
  }

  private async insertIfMissing({
    existingRows,
    insertQuery,
    countQuery,
  }: {
    existingRows: number;
    insertQuery: string;
    countQuery: string;
  }): Promise<number> {
    if (existingRows > 0) {
      return 0;
    }

    await this.executeQuery(insertQuery);
    return await this.querySingleNumericResult(countQuery);
  }

  private async executeQuery(query: string): Promise<void> {
    const queryResponse = await this.database.query(query);
    const queryId = queryResponse.QueryExecutionId;

    if (!queryId) {
      throw new Error('Failed to execute Athena query');
    }

    const queryState = await this.database.waitForQuery(queryId);
    if (queryState !== QueryExecutionState.SUCCEEDED) {
      throw new Error(`Athena query failed with status: ${queryState}`);
    }
  }

  private async querySingleNumericResult(query: string): Promise<number> {
    const queryResponse = await this.database.query(query);
    const queryId = queryResponse.QueryExecutionId;

    if (!queryId) {
      throw new Error('Failed to execute Athena query');
    }

    const queryState = await this.database.waitForQuery(queryId);
    if (queryState !== QueryExecutionState.SUCCEEDED) {
      throw new Error(`Athena query failed with status: ${queryState}`);
    }

    const results = await this.database.getResults(queryId);

    return this.readFirstNumericCell(results);
  }

  private readFirstNumericCell(queryResults: GetQueryResultsOutput): number {
    const rows = queryResults.ResultSet?.Rows;

    if (!rows || rows.length < 2) {
      return 0;
    }

    const resultValue = rows[1].Data?.[0].VarCharValue;

    if (!resultValue) {
      return 0;
    }

    const numericValue = Number(resultValue);

    return Number.isNaN(numericValue) ? 0 : numericValue;
  }

  private yesterdayUtc(): Date {
    const now = new Date();

    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  }
}
