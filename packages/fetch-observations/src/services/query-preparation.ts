import { Database } from "packages/cloud-computing";
import { QueryExecutionState, StartQueryExecutionOutput } from "@aws-sdk/client-athena";
import { ObservationQueries } from "../queries/observation-queries";
import { ValidatedQueryStringParams } from "./query-string-param-validator";

export class QueryPreparation {
  public queryResponse: StartQueryExecutionOutput = {};

  private queryState?: QueryExecutionState;

  public constructor(
    private databaseService: Database,
    private parameters: ValidatedQueryStringParams,
  ) {}

  public async valid(): Promise<boolean> {
    const queryString = ObservationQueries.getObservationsByDateRange(this.parameters);
    this.queryResponse = await this.databaseService.query(queryString);

    if (!this.queryCreated()) {
      return false;
    }

    this.queryState = await this.waitForQuery();

    return this.querySucceeded();
  }

  public responseText(): string {
    if (!this.queryCreated()) {
      return 'Failed to execute Athena query';
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

  private async waitForQuery(): Promise<QueryExecutionState | undefined> {
    return await this.databaseService.waitForQuery(this.queryResponse.QueryExecutionId as string);
  }
}
