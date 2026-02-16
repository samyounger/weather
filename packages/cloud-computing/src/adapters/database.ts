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
  StartQueryExecutionOutput
} from "@aws-sdk/client-athena";
import { databaseClient } from "./client";
import { BucketLocationConstraint } from "@aws-sdk/client-s3";

const REGION: BucketLocationConstraint = 'eu-west-2';
const OUTPUT_LOCATION = 's3://weather-tempest-records/queries/';
const DATABASE = 'tempest_weather';

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
      WorkGroup: "primary",
      ResultReuseConfiguration: {
        ResultReuseByAgeConfiguration: {
          Enabled: false,
        },
      },
    };
    const command = new StartQueryExecutionCommand(input);
    return await client.send(command);
  }

  public async waitForQuery(queryExecutionId: string): Promise<QueryExecutionState | undefined> {
    const queryLoop = async (queryCount = 0): Promise<QueryExecutionState | undefined> => {
      const queryStatus = await this.queryStatus(queryExecutionId);
      if (
        queryStatus === QueryExecutionState.SUCCEEDED ||
        queryStatus === QueryExecutionState.FAILED ||
        queryStatus === QueryExecutionState.CANCELLED ||
        queryCount >= 120
      ) {
        return queryStatus;
      }

      return await new Promise((resolve) => {
        setTimeout(() => {
          resolve(queryLoop(queryCount += 1));
        }, 2000);
      });
    };

    return await queryLoop();
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

  public async getResults(queryExecutionId: string): Promise<GetQueryResultsOutput> {
    const client = await this.client;
    const input: GetQueryResultsInput = {
      QueryExecutionId: queryExecutionId,
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
    const partitionLocation = `s3://weather-tempest-records/year=${year}/month=${month}/day=${day}/hour=${hour}/`;
    const query = `ALTER TABLE observations ADD IF NOT EXISTS PARTITION (year='${year}', month='${month}', day='${day}', hour='${hour}') LOCATION '${partitionLocation}';`;
    try {
      const result = await this.query(query);
      const queryId = result.QueryExecutionId;
      if (!queryId) {
        return false;
      }

      const state = await this.waitForQuery(queryId);
      return state === QueryExecutionState.SUCCEEDED;
    } catch {
      return false;
    }
  }
}
