import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { Database } from '@weather/cloud-computing';
import { ObservationsFactory } from '../factories/observations-factory';
import { QueryPreparation } from './query-preparation';
import { ValidatedQueryStringParams } from './query-string-param-validator';
import { QueryTarget } from './query-target';

type SyncQueryParams = Required<Pick<
ValidatedQueryStringParams,
'from' | 'to' | 'fromEpochSeconds' | 'toEpochSeconds' | 'fields' | 'limit'
>> & {
  mode: 'sync';
  nextToken?: string;
  resolution?: 'auto' | '15m' | 'daily' | 'monthly';
};

const isSyncQueryParams = (parameters: ValidatedQueryStringParams): parameters is SyncQueryParams => (
  parameters.mode === 'sync' &&
  Boolean(
    parameters.from &&
    parameters.to &&
    parameters.fromEpochSeconds !== undefined &&
    parameters.toEpochSeconds !== undefined &&
    parameters.fields &&
    parameters.limit,
  )
);

export const handleSyncQuery = async (
  event: APIGatewayProxyEvent,
  context: Context,
  databaseService: Database,
  queryTarget: QueryTarget,
  validatedParameters: ValidatedQueryStringParams,
): Promise<APIGatewayProxyResult> => {
  if (!isSyncQueryParams(validatedParameters)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Sync mode requires from and to query parameters' }),
    };
  }

  const queryPreparation = new QueryPreparation(databaseService, validatedParameters, {
    tableName: queryTarget.tableName,
    timestampColumn: queryTarget.timestampColumn,
  }, {
    queryTimeoutMs: Number.parseInt(process.env.QUERY_TIMEOUT_MS ?? '25000', 10),
    timeoutSafetyBufferMs: Number.parseInt(process.env.QUERY_TIMEOUT_SAFETY_BUFFER_MS ?? '5000', 10),
    getRemainingTimeInMillis: context.getRemainingTimeInMillis,
  });
  const queryPreparationValid = await queryPreparation.valid();
  if (!queryPreparationValid) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: queryPreparation.responseText() }),
    };
  }

  const queryExecutionId = queryPreparation.queryResponse.QueryExecutionId as string;
  const queryResultsResponse = await databaseService.getResults(queryExecutionId, validatedParameters.nextToken);
  const queryResults = ObservationsFactory.build(queryResultsResponse);

  if (!queryResults || !queryResults[0]) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to retrieve Athena query results' }),
    };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      mode: 'sync',
      table: queryTarget.tableName,
      queryExecutionId,
      nextToken: queryResultsResponse.NextToken,
      parameters: event.queryStringParameters,
      data: queryResults,
    }),
  };
};
