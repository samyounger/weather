import dotEnv from 'dotenv';
import { Database } from '@weather/cloud-computing';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { QueryExecutionState } from '@aws-sdk/client-athena';
import { ObservationsFactory } from "./factories/observations-factory";
import { ObservationQueries } from "./queries/observation-queries";
import { QueryStringParams, QueryStringParamValidator, ValidatedQueryStringParams } from "./services/query-string-param-validator";
import { QueryPreparation } from "./services/query-preparation";

dotEnv.config({ path:'../../.env' });

type SyncQueryParams = Required<Pick<ValidatedQueryStringParams, 'from' | 'to' | 'fromEpochSeconds' | 'toEpochSeconds' | 'fields' | 'limit'>> &
{ mode: 'sync', nextToken?: string };

type RangeQueryParams = Required<Pick<ValidatedQueryStringParams, 'from' | 'to' | 'fromEpochSeconds' | 'toEpochSeconds' | 'fields' | 'limit'>> &
{ mode: 'sync' | 'async', nextToken?: string };

const hasRangeQueryParams = (parameters: ValidatedQueryStringParams): parameters is RangeQueryParams => {
  return Boolean(
    parameters.from &&
    parameters.to &&
    parameters.fromEpochSeconds !== undefined &&
    parameters.toEpochSeconds !== undefined &&
    parameters.fields &&
    parameters.limit,
  );
};

const isSyncQueryParams = (parameters: ValidatedQueryStringParams): parameters is SyncQueryParams => {
  return parameters.mode === 'sync' && hasRangeQueryParams(parameters);
};

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const parameters = event.queryStringParameters as QueryStringParams;
  console.info('fetch-observations invocation started', {
    service: 'fetch-observations',
    parameters,
  });
  try {
    const queryStringParamValidator = new QueryStringParamValidator(parameters);
    if (!queryStringParamValidator.valid()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: queryStringParamValidator.returnError() }),
      };
    }
    const validatedParameters = queryStringParamValidator.validated();
    if (!validatedParameters) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Unable to parse query parameters' }),
      };
    }

    const databaseService = new Database();

    if (validatedParameters.mode === 'async') {
      return await handleAsyncQuery(databaseService, validatedParameters);
    }

    if (!isSyncQueryParams(validatedParameters)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Sync mode requires from and to query parameters' }),
      };
    }

    const queryPreparation = new QueryPreparation(databaseService, validatedParameters, {
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
        queryExecutionId,
        nextToken: queryResultsResponse.NextToken,
        parameters: event.queryStringParameters,
        data: queryResults,
      }),
    };
  } catch (error) {
    console.error('fetch-observations invocation failed', {
      service: 'fetch-observations',
      parameters,
      error,
    });
    throw error;
  }
};

const handleAsyncQuery = async (
  databaseService: Database,
  validatedParameters: ValidatedQueryStringParams,
): Promise<APIGatewayProxyResult> => {
  if (validatedParameters.queryExecutionId) {
    const state = await databaseService.getQueryState(validatedParameters.queryExecutionId);

    if (state === QueryExecutionState.SUCCEEDED) {
      const queryResultsResponse = await databaseService.getResults(validatedParameters.queryExecutionId, validatedParameters.nextToken);
      return {
        statusCode: 200,
        body: JSON.stringify({
          mode: 'async',
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

  const queryString = ObservationQueries.getObservationsByDateRange(validatedParameters);
  const queryResponse = await databaseService.query(queryString);

  return {
    statusCode: 202,
    body: JSON.stringify({
      mode: 'async',
      status: QueryExecutionState.RUNNING,
      queryExecutionId: queryResponse.QueryExecutionId,
    }),
  };
};
