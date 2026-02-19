import {
  AthenaClient,
  GetQueryExecutionCommand,
  GetQueryExecutionInput,
  GetQueryResultsCommand,
  GetQueryResultsInput,
  GetQueryResultsOutput,
  QueryExecutionState,
  StartQueryExecutionCommand,
  StartQueryExecutionInput,
  StartQueryExecutionOutput,
  StopQueryExecutionCommand,
} from "@aws-sdk/client-athena";
import { databaseClient } from "./client";
import { BucketLocationConstraint } from "@aws-sdk/client-s3";

const REGION: BucketLocationConstraint = 'eu-west-2';
const OUTPUT_LOCATION = 's3://weather-tempest-records/queries/';
const DATABASE = 'tempest_weather';
const WORKGROUP = process.env.ATHENA_WORKGROUP ?? 'primary';
const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_MAX_POLLS = 120;

export type WaitForQueryOptions = {
  maxPolls?: number;
  pollIntervalMs?: number;
  maxWaitMs?: number;
  stopWhen?: () => boolean;
};

type ObservationsPartition = {
  year: string;
  month: string;
  day: string;
  hour: string;
};

export class Database {
  private readonly client: Promise<AthenaClient>;

  public constructor() {
    this.client = databaseClient(REGION);
  }

  public async query(queryString: string): Promise<StartQueryExecutionOutput> {
    const client = await this.client;
    const input: StartQueryExecutionInput = {
      QueryString: queryString,
      QueryExecutionContext: {
        Database: DATABASE,
        Catalog: "AwsDataCatalog",
      },
      ResultConfiguration: {
        OutputLocation: OUTPUT_LOCATION,
        EncryptionConfiguration: {
          EncryptionOption: "SSE_S3",
        },
        AclConfiguration: {
          S3AclOption: "BUCKET_OWNER_FULL_CONTROL",
        },
      },
      WorkGroup: WORKGROUP,
      ResultReuseConfiguration: {
        ResultReuseByAgeConfiguration: {
          Enabled: false,
        },
      },
    };
    const command = new StartQueryExecutionCommand(input);
    return await client.send(command);
  }

  public async waitForQuery(
    queryExecutionId: string,
    {
      maxPolls = DEFAULT_MAX_POLLS,
      pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
      maxWaitMs,
      stopWhen,
    }: WaitForQueryOptions = {},
  ): Promise<QueryExecutionState | undefined> {
    const startedAt = Date.now();

    for (let queryCount = 0; queryCount <= maxPolls; queryCount += 1) {
      if (stopWhen?.()) {
        await this.cancelQuery(queryExecutionId);
        return QueryExecutionState.CANCELLED;
      }

      if (maxWaitMs && (Date.now() - startedAt) >= maxWaitMs) {
        await this.cancelQuery(queryExecutionId);
        return QueryExecutionState.CANCELLED;
      }

      const queryStatus = await this.queryStatus(queryExecutionId);
      if (
        queryStatus === QueryExecutionState.SUCCEEDED ||
        queryStatus === QueryExecutionState.FAILED ||
        queryStatus === QueryExecutionState.CANCELLED ||
        queryCount >= maxPolls
      ) {
        return queryStatus;
      }

      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    return QueryExecutionState.CANCELLED;
  }

  public async cancelQuery(queryExecutionId: string): Promise<void> {
    const client = await this.client;
    try {
      await client.send(new StopQueryExecutionCommand({ QueryExecutionId: queryExecutionId }));
    } catch (error) {
      console.error('Failed to cancel Athena query', {
        queryExecutionId,
        error,
      });
    }
  }

  public async getQueryState(queryExecutionId: string): Promise<QueryExecutionState | undefined> {
    return await this.queryStatus(queryExecutionId);
  }

  private async queryStatus(queryExecutionId: string): Promise<QueryExecutionState | undefined> {
    const client = await this.client;
    const input: GetQueryExecutionInput = {
      QueryExecutionId: queryExecutionId,
    };
    const command = new GetQueryExecutionCommand(input);
    const response = await client.send(command);
    if (!response.QueryExecution) {
      throw new Error('Query execution not found');
    }

    if (!response.QueryExecution.Status) {
      throw new Error('Query execution status not found');
    }

    return response.QueryExecution.Status.State;
  }

  public async getResults(queryExecutionId: string, nextToken?: string): Promise<GetQueryResultsOutput> {
    const client = await this.client;
    const input: GetQueryResultsInput = {
      QueryExecutionId: queryExecutionId,
      NextToken: nextToken,
    };
    const command = new GetQueryResultsCommand(input);
    return await client.send(command);
  }

  /**
   * Adds a partition to the observations table for the given year, month, day, hour.
   * @param year string
   * @param month string
   * @param day string
   * @param hour string
   * @returns Promise<boolean>
   */
  public async addObservationsPartition(year: string, month: string, day: string, hour: string): Promise<boolean> {
    return await this.addObservationsPartitions([{ year, month, day, hour }]);
  }

  public async addObservationsPartitions(partitions: ObservationsPartition[]): Promise<boolean> {
    if (!partitions.length) {
      return true;
    }

    const partitionStatements = partitions.map(({ year, month, day, hour }) => {
      const location = `s3://weather-tempest-records/year=${year}/month=${month}/day=${day}/hour=${hour}/`;

      return `PARTITION (year='${year}', month='${month}', day='${day}', hour='${hour}') LOCATION '${location}'`;
    }).join('\n');

    const query = `ALTER TABLE observations ADD IF NOT EXISTS\n${partitionStatements};`;

    try {
      const result = await this.query(query);
      const queryId = result.QueryExecutionId;
      if (!queryId) {
        return false;
      }

      const state = await this.waitForQuery(queryId);
      return state === QueryExecutionState.SUCCEEDED;
    } catch (error) {
      console.error('Failed to add observations partitions', {
        partitions,
        error,
      });
      return false;
    }
  }
}
