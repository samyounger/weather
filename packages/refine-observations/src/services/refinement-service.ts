import { GetQueryResultsOutput, QueryExecutionState } from '@aws-sdk/client-athena';
import { Database } from '@weather/cloud-computing';
import { RefinementQueries } from './refinement-queries';

export type RefinementSummary = {
  date: string;
  inserted: boolean;
  existingRows: number;
};

export class RefinementService {
  public constructor(private readonly database: Database) {}

  public async refineForYesterday(): Promise<RefinementSummary> {
    const targetDate = this.yesterdayUtc();

    return await this.refineForDate(targetDate);
  }

  public async refineForDate(targetDate: Date): Promise<RefinementSummary> {
    const parts = this.partitionDateParts(targetDate);

    await this.executeQuery(RefinementQueries.createRefinedTable());

    const existingRows = await this.querySingleNumericResult(RefinementQueries.existingRowsForDate(parts));
    if (existingRows > 0) {
      return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        inserted: false,
        existingRows,
      };
    }

    await this.executeQuery(RefinementQueries.insertRefinedRowsForDate(parts));

    return {
      date: `${parts.year}-${parts.month}-${parts.day}`,
      inserted: true,
      existingRows,
    };
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

  private partitionDateParts(targetDate: Date): { year: string; month: string; day: string } {
    const year = targetDate.getUTCFullYear().toString();
    const month = (targetDate.getUTCMonth() + 1).toString().padStart(2, '0');
    const day = targetDate.getUTCDate().toString().padStart(2, '0');

    return { year, month, day };
  }

  private yesterdayUtc(): Date {
    const now = new Date();

    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  }
}
