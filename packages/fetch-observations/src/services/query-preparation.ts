import { Database } from "@weather/cloud-computing";
import { QueryExecutionState, StartQueryExecutionOutput } from "@aws-sdk/client-athena";
import { ObservationQueries } from "../queries/observation-queries";
import { ValidatedQueryStringParams } from "./query-string-param-validator";

const DEFAULT_QUERY_TIMEOUT_MS = 25000;
const DEFAULT_TIMEOUT_SAFETY_BUFFER_MS = 5000;

type QueryPreparationOptions = {
  queryTimeoutMs?: number;
  timeoutSafetyBufferMs?: number;
  getRemainingTimeInMillis?: () => number;
};

type SyncValidatedQueryStringParams = Required<Pick<
  ValidatedQueryStringParams,
  'from' | 'to' | 'fromEpochSeconds' | 'toEpochSeconds' | 'fields' | 'limit'
>>;

export class QueryPreparation {
  public queryResponse: StartQueryExecutionOutput = {};

  private queryState?: QueryExecutionState;

  public constructor(
    private databaseService: Database,
    private parameters: SyncValidatedQueryStringParams,
    private options: QueryPreparationOptions = {},
  ) {}

  public async valid(): Promise<boolean> {
    const queryString = ObservationQueries.getObservationsByDateRange(this.parameters);
    this.queryResponse = await this.databaseService.query(queryString);

    if (!this.queryCreated()) {
      return false;
    }

    const queryTimeoutMs = this.options.queryTimeoutMs ?? DEFAULT_QUERY_TIMEOUT_MS;
    const timeoutSafetyBufferMs = this.options.timeoutSafetyBufferMs ?? DEFAULT_TIMEOUT_SAFETY_BUFFER_MS;
    this.queryState = await this.waitForQuery({ queryTimeoutMs, timeoutSafetyBufferMs });

    return this.querySucceeded();
  }

  public responseText(): string {
    if (!this.queryCreated()) {
      return 'Failed to execute Athena query';
    }

    if (this.queryState === QueryExecutionState.CANCELLED) {
      return 'Athena query timed out and was cancelled';
    }

    if (this.querySucceeded()) {
      return 'Athena query processed successfully';
    }

    return 'Failed to process Athena query';
  }

  private queryCreated(): boolean {
    return !!this.queryResponse.QueryExecutionId;
  }

  private querySucceeded(): boolean {
    return this.queryState === QueryExecutionState.SUCCEEDED;
  }

  private async waitForQuery({ queryTimeoutMs, timeoutSafetyBufferMs }: { queryTimeoutMs: number, timeoutSafetyBufferMs: number }): Promise<QueryExecutionState | undefined> {
    return await this.databaseService.waitForQuery(
      this.queryResponse.QueryExecutionId as string,
      {
        maxWaitMs: queryTimeoutMs,
        stopWhen: this.options.getRemainingTimeInMillis
          ? () => this.options.getRemainingTimeInMillis!() <= timeoutSafetyBufferMs
          : undefined,
      },
    );
  }
}
