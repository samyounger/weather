import { APIGatewayProxyResult } from 'aws-lambda';
import { QueryExecutionState } from '@aws-sdk/client-athena';
import { Database } from '@weather/cloud-computing';
import { ObservationsFactory } from '../factories/observations-factory';
import { ObservationQueries } from '../queries/observation-queries';
import { ValidatedQueryStringParams } from './query-string-param-validator';
import { QueryTarget } from './query-target';

type AsyncStartQueryParams = Required<Pick<
ValidatedQueryStringParams,
'from' | 'to' | 'fromEpochSeconds' | 'toEpochSeconds' | 'fields' | 'limit'
>> & {
  mode: 'async' | 'sync';
  nextToken?: string;
  resolution?: 'auto' | '15m' | 'daily' | 'monthly';
};

const hasRangeQueryParams = (parameters: ValidatedQueryStringParams): parameters is AsyncStartQueryParams => (
  Boolean(
    parameters.from &&
    parameters.to &&
    parameters.fromEpochSeconds !== undefined &&
    parameters.toEpochSeconds !== undefined &&
    parameters.fields &&
    parameters.limit,
  )
);

export const handleAsyncQuery = async (
  databaseService: Database,
  validatedParameters: ValidatedQueryStringParams,
  queryTarget: QueryTarget,
): Promise<APIGatewayProxyResult> => {
  if (validatedParameters.queryExecutionId) {
    const state = await databaseService.getQueryState(validatedParameters.queryExecutionId);

    if (state === QueryExecutionState.SUCCEEDED) {
      const queryResultsResponse = await databaseService.getResults(validatedParameters.queryExecutionId, validatedParameters.nextToken);
      return {
        statusCode: 200,
        body: JSON.stringify({
          mode: 'async',
          table: queryTarget.tableName,
          status: QueryExecutionState.SUCCEEDED,
          queryExecutionId: validatedParameters.queryExecutionId,
          nextToken: queryResultsResponse.NextToken,
          data: ObservationsFactory.build(queryResultsResponse),
        }),
      };
    }

    if (state === QueryExecutionState.FAILED || state === QueryExecutionState.CANCELLED) {
      return {
        statusCode: 500,
        body: JSON.stringify({
          mode: 'async',
          table: queryTarget.tableName,
          status: state,
          queryExecutionId: validatedParameters.queryExecutionId,
          error: 'Athena query did not complete successfully',
        }),
      };
    }

    return {
      statusCode: 202,
      body: JSON.stringify({
        mode: 'async',
        table: queryTarget.tableName,
        status: state,
        queryExecutionId: validatedParameters.queryExecutionId,
      }),
    };
  }

  if (!hasRangeQueryParams(validatedParameters)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Async mode start requires from and to query parameters' }),
    };
  }

  const queryString = ObservationQueries.getByDateRange({
    from: validatedParameters.from,
    to: validatedParameters.to,
    fromEpochSeconds: validatedParameters.fromEpochSeconds,
    toEpochSeconds: validatedParameters.toEpochSeconds,
    fields: validatedParameters.fields,
    limit: validatedParameters.limit,
    tableName: queryTarget.tableName,
    timestampColumn: queryTarget.timestampColumn,
  });
  const queryResponse = await databaseService.query(queryString);

  return {
    statusCode: 202,
    body: JSON.stringify({
      mode: 'async',
      table: queryTarget.tableName,
      status: QueryExecutionState.RUNNING,
      queryExecutionId: queryResponse.QueryExecutionId,
    }),
  };
};
