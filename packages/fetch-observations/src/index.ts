import dotEnv from 'dotenv';
import { Database } from '@weather/cloud-computing';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { QueryExecutionState } from '@aws-sdk/client-athena';
import { ObservationsFactory } from "./factories/observations-factory";
import { ObservationQueries } from "./queries/observation-queries";
import { QueryStringParams, QueryStringParamValidator, ValidatedQueryStringParams } from "./services/query-string-param-validator";
import { QueryPreparation } from "./services/query-preparation";
import { QueryRegistry, QueryRegistryStatus } from "./services/query-registry";
import { buildRequestKey } from "./services/request-key";
import { resolveSeriesQuery } from "./services/series-query-resolution";
import { getQueryTargetFromPath, QueryTarget } from "./services/query-target";

dotEnv.config({ path:'../../.env' });

type SyncQueryParams = Required<Pick<ValidatedQueryStringParams, 'from' | 'to' | 'fromEpochSeconds' | 'toEpochSeconds' | 'fields' | 'limit'>> &
{ mode: 'sync', nextToken?: string, resolution?: 'auto' | '15m' | 'daily' | 'monthly' };

type RangeQueryParams = Required<Pick<ValidatedQueryStringParams, 'from' | 'to' | 'fromEpochSeconds' | 'toEpochSeconds' | 'fields' | 'limit'>> &
{ mode: 'sync' | 'async', nextToken?: string, resolution?: 'auto' | '15m' | 'daily' | 'monthly' };

const FIVE_SECONDS_MS = 5000;
const QUERY_TTL_SECONDS = 24 * 60 * 60;

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

const queryStateToRegistryStatus = (state: QueryExecutionState): QueryRegistryStatus => {
  if (state === QueryExecutionState.SUCCEEDED) {
    return 'SUCCEEDED';
  }

  if (state === QueryExecutionState.FAILED) {
    return 'FAILED';
  }

  return 'CANCELLED';
};

const queryTargetError = 'Unsupported endpoint. Use /observations, /refined, or /series';

const getUserKey = (event: APIGatewayProxyEvent): string => {
  const claims = (event.requestContext.authorizer as { jwt?: { claims?: Record<string, string> } } | undefined)?.jwt?.claims;
  return claims?.sub ?? claims?.email ?? 'anonymous';
};

const nowIso = () => new Date().toISOString();

const expiresAtEpochSeconds = () => Math.floor(Date.now() / 1000) + QUERY_TTL_SECONDS;

const getSeriesPollUrl = (event: APIGatewayProxyEvent, requestKey: string) => {
  const domainName = event.requestContext.domainName;
  const stage = event.requestContext.stage && event.requestContext.stage !== '$default'
    ? `/${event.requestContext.stage}`
    : '';

  if (!domainName) {
    return `/series?mode=async&requestKey=${requestKey}`;
  }

  return `https://${domainName}${stage}/series?mode=async&requestKey=${requestKey}`;
};

const buildSeriesQuery = (parameters: SyncQueryParams) => {
  const resolvedQuery = resolveSeriesQuery({
    from: parameters.from,
    to: parameters.to,
    resolution: parameters.resolution ?? 'auto',
  });

  const queryString = resolvedQuery.aggregationLevel === 'monthly'
    ? ObservationQueries.getMonthlySeriesByDateRange(parameters)
    : resolvedQuery.aggregationLevel === 'daily'
      ? ObservationQueries.getDailySeriesByDateRange(parameters)
      : ObservationQueries.getRefinedByDateRange(parameters);

  return {
    ...resolvedQuery,
    queryString,
  };
};

const buildSeriesSuccessResponse = async ({
  databaseService,
  queryExecutionId,
  requestKey,
  aggregationLevel,
  tableName,
  nextToken,
}: {
  databaseService: Database;
  queryExecutionId: string;
  requestKey: string;
  aggregationLevel: '15m' | 'daily' | 'monthly';
  tableName: string;
  nextToken?: string;
}): Promise<APIGatewayProxyResult> => {
  const queryResultsResponse = await databaseService.getResults(queryExecutionId, nextToken);

  return {
    statusCode: 200,
    body: JSON.stringify({
      mode: 'async',
      status: 'SUCCEEDED',
      table: tableName,
      aggregationLevel,
      requestKey,
      queryExecutionId,
      nextToken: queryResultsResponse.NextToken,
      data: ObservationsFactory.build(queryResultsResponse),
    }),
  };
};

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const endpointPath = (event as APIGatewayProxyEvent & { rawPath?: string }).rawPath ?? event.path;
  const queryTarget = getQueryTargetFromPath(endpointPath);
  const parameters = event.queryStringParameters as QueryStringParams;
  console.info('fetch-observations invocation started', {
    service: 'fetch-observations',
    endpointPath,
    queryTarget: queryTarget?.tableName,
    parameters,
  });
  try {
    if (!queryTarget) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: queryTargetError }),
      };
    }

    const queryStringParamValidator = new QueryStringParamValidator(parameters, queryTarget);
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
    const queryRegistry = new QueryRegistry();

    if (queryTarget.routeName === 'series') {
      return await handleSeriesQuery(event, context, databaseService, queryRegistry, validatedParameters);
    }

    if (validatedParameters.mode === 'async') {
      return await handleAsyncQuery(databaseService, validatedParameters, queryTarget);
    }

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
  } catch (error) {
    console.error('fetch-observations invocation failed', {
      service: 'fetch-observations',
      endpointPath,
      queryTarget: queryTarget?.tableName,
      parameters,
      error,
    });
    throw error;
  }
};

const handleSeriesQuery = async (
  event: APIGatewayProxyEvent,
  context: Context,
  databaseService: Database,
  queryRegistry: QueryRegistry,
  validatedParameters: ValidatedQueryStringParams,
): Promise<APIGatewayProxyResult> => {
  if (validatedParameters.mode === 'async' && validatedParameters.requestKey) {
    const existingRecord = await queryRegistry.get(validatedParameters.requestKey);
    if (!existingRecord) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Query request was not found or has expired' }),
      };
    }

    const state = await databaseService.getQueryState(existingRecord.queryExecutionId);
    if (state === QueryExecutionState.SUCCEEDED || existingRecord.status === 'SUCCEEDED') {
      await queryRegistry.update({
        requestKey: existingRecord.requestKey,
        status: 'SUCCEEDED',
        updatedAt: nowIso(),
        expiresAt: expiresAtEpochSeconds(),
      });

      return await buildSeriesSuccessResponse({
        databaseService,
        queryExecutionId: existingRecord.queryExecutionId,
        requestKey: existingRecord.requestKey,
        aggregationLevel: existingRecord.aggregationLevel,
        tableName: existingRecord.tableName,
        nextToken: validatedParameters.nextToken,
      });
    }

    if (state === QueryExecutionState.FAILED || state === QueryExecutionState.CANCELLED) {
      await queryRegistry.update({
        requestKey: existingRecord.requestKey,
        status: queryStateToRegistryStatus(state),
        updatedAt: nowIso(),
        expiresAt: expiresAtEpochSeconds(),
      });

      return {
        statusCode: 500,
        body: JSON.stringify({
          status: 'FAILED',
          requestKey: existingRecord.requestKey,
          queryExecutionId: existingRecord.queryExecutionId,
          aggregationLevel: existingRecord.aggregationLevel,
          error: 'The long-range query failed before results were ready. Retry the request or check back shortly.',
          pollUrl: getSeriesPollUrl(event, existingRecord.requestKey),
        }),
      };
    }

    return {
      statusCode: 202,
      body: JSON.stringify({
        status: 'PENDING',
        requestKey: existingRecord.requestKey,
        queryExecutionId: existingRecord.queryExecutionId,
        aggregationLevel: existingRecord.aggregationLevel,
        pollAfterMs: 1000,
        pollUrl: getSeriesPollUrl(event, existingRecord.requestKey),
      }),
    };
  }

  if (!isSyncQueryParams(validatedParameters)) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Series queries require from and to query parameters' }),
    };
  }

  const resolvedSeriesQuery = buildSeriesQuery(validatedParameters);
  const userKey = getUserKey(event);
  const requestKey = buildRequestKey({
    userKey,
    parameters: validatedParameters,
    aggregationLevel: resolvedSeriesQuery.aggregationLevel,
  });

  const existingRecord = await queryRegistry.get(requestKey);
  if (existingRecord) {
    if (existingRecord.status === 'SUCCEEDED') {
      return await buildSeriesSuccessResponse({
        databaseService,
        queryExecutionId: existingRecord.queryExecutionId,
        requestKey: existingRecord.requestKey,
        aggregationLevel: existingRecord.aggregationLevel,
        tableName: existingRecord.tableName,
        nextToken: validatedParameters.nextToken,
      });
    }

    if (existingRecord.status === 'RUNNING') {
      return {
        statusCode: 202,
        body: JSON.stringify({
          status: 'PENDING',
          requestKey: existingRecord.requestKey,
          queryExecutionId: existingRecord.queryExecutionId,
          aggregationLevel: existingRecord.aggregationLevel,
          pollAfterMs: 1000,
          pollUrl: getSeriesPollUrl(event, existingRecord.requestKey),
        }),
      };
    }
  }

  const queryResponse = await databaseService.query(resolvedSeriesQuery.queryString);
  const queryExecutionId = queryResponse.QueryExecutionId;

  if (!queryExecutionId) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to execute Athena query' }),
    };
  }

  const created = await queryRegistry.create({
    requestKey,
    userKey,
    queryExecutionId,
    status: 'RUNNING',
    aggregationLevel: resolvedSeriesQuery.aggregationLevel,
    tableName: resolvedSeriesQuery.tableName,
    queryString: resolvedSeriesQuery.queryString,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    expiresAt: expiresAtEpochSeconds(),
  });

  if (!created) {
    const latestRecord = await queryRegistry.get(requestKey);
    if (latestRecord) {
      return {
        statusCode: 202,
        body: JSON.stringify({
          status: latestRecord.status === 'SUCCEEDED' ? 'SUCCEEDED' : 'PENDING',
          requestKey: latestRecord.requestKey,
          queryExecutionId: latestRecord.queryExecutionId,
          aggregationLevel: latestRecord.aggregationLevel,
          pollAfterMs: 1000,
          pollUrl: getSeriesPollUrl(event, latestRecord.requestKey),
        }),
      };
    }
  }

  const queryState = await databaseService.waitForQuery(queryExecutionId, {
    maxWaitMs: Math.min(FIVE_SECONDS_MS, context.getRemainingTimeInMillis() - 250),
    cancelOnTimeout: false,
  } as { maxWaitMs: number } & Record<string, boolean | number>);

  if (queryState === QueryExecutionState.SUCCEEDED) {
    await queryRegistry.update({
      requestKey,
      status: 'SUCCEEDED',
      updatedAt: nowIso(),
      expiresAt: expiresAtEpochSeconds(),
    });

    return await buildSeriesSuccessResponse({
      databaseService,
      queryExecutionId,
      requestKey,
      aggregationLevel: resolvedSeriesQuery.aggregationLevel,
      tableName: resolvedSeriesQuery.tableName,
      nextToken: validatedParameters.nextToken,
    });
  }

  if (queryState === QueryExecutionState.FAILED || queryState === QueryExecutionState.CANCELLED) {
    await queryRegistry.update({
      requestKey,
      status: queryStateToRegistryStatus(queryState),
      updatedAt: nowIso(),
      expiresAt: expiresAtEpochSeconds(),
    });

    return {
      statusCode: 500,
      body: JSON.stringify({
        status: 'FAILED',
        requestKey,
        queryExecutionId,
        aggregationLevel: resolvedSeriesQuery.aggregationLevel,
        error: 'The long-range query failed before results were ready. Retry the request or adjust the date range.',
      }),
    };
  }

  return {
    statusCode: 202,
    body: JSON.stringify({
      status: 'PENDING',
      requestKey,
      queryExecutionId,
      aggregationLevel: resolvedSeriesQuery.aggregationLevel,
      pollAfterMs: 1000,
      pollUrl: getSeriesPollUrl(event, requestKey),
    }),
  };
};

const handleAsyncQuery = async (
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
    ...validatedParameters,
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
