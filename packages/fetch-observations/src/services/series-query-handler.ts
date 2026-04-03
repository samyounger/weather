import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { QueryExecutionState } from '@aws-sdk/client-athena';
import { Database } from '@weather/cloud-computing';
import { ObservationsFactory } from '../factories/observations-factory';
import { ObservationQueries } from '../queries/observation-queries';
import { ValidatedQueryStringParams } from './query-string-param-validator';
import { QueryRegistry, QueryRegistryStatus } from './query-registry';
import { buildRequestKey } from './request-key';
import { resolveSeriesQuery } from './series-query-resolution';

type SyncSeriesQueryParams = Required<Pick<
ValidatedQueryStringParams,
'from' | 'to' | 'fromEpochSeconds' | 'toEpochSeconds' | 'fields' | 'limit'
>> & {
  mode: 'sync';
  nextToken?: string;
  resolution?: 'auto' | '15m' | 'daily' | 'monthly';
};

const FIVE_SECONDS_MS = 5000;
const QUERY_TTL_SECONDS = 24 * 60 * 60;

const hasSeriesRangeParams = (parameters: ValidatedQueryStringParams): parameters is SyncSeriesQueryParams => (
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

const queryStateToRegistryStatus = (state: QueryExecutionState): QueryRegistryStatus => {
  if (state === QueryExecutionState.SUCCEEDED) {
    return 'SUCCEEDED';
  }

  if (state === QueryExecutionState.FAILED) {
    return 'FAILED';
  }

  return 'CANCELLED';
};

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

const buildSeriesQuery = (parameters: SyncSeriesQueryParams) => {
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

const buildPendingResponse = (
  event: APIGatewayProxyEvent,
  requestKey: string,
  queryExecutionId: string,
  aggregationLevel: '15m' | 'daily' | 'monthly',
): APIGatewayProxyResult => ({
  statusCode: 202,
  body: JSON.stringify({
    status: 'PENDING',
    requestKey,
    queryExecutionId,
    aggregationLevel,
    pollAfterMs: 1000,
    pollUrl: getSeriesPollUrl(event, requestKey),
  }),
});

const buildFailedResponse = (
  event: APIGatewayProxyEvent,
  requestKey: string,
  queryExecutionId: string,
  aggregationLevel: '15m' | 'daily' | 'monthly',
  error: string,
): APIGatewayProxyResult => ({
  statusCode: 500,
  body: JSON.stringify({
    status: 'FAILED',
    requestKey,
    queryExecutionId,
    aggregationLevel,
    error,
    pollUrl: getSeriesPollUrl(event, requestKey),
  }),
});

const buildExistingSeriesResponse = async (
  event: APIGatewayProxyEvent,
  databaseService: Database,
  requestKey: string,
  nextToken: string | undefined,
  existingRecord: {
    requestKey: string;
    queryExecutionId: string;
    status: QueryRegistryStatus;
    aggregationLevel: '15m' | 'daily' | 'monthly';
    tableName: string;
  },
): Promise<APIGatewayProxyResult | null> => {
  if (existingRecord.status === 'SUCCEEDED') {
    return buildSeriesSuccessResponse({
      databaseService,
      queryExecutionId: existingRecord.queryExecutionId,
      requestKey,
      aggregationLevel: existingRecord.aggregationLevel,
      tableName: existingRecord.tableName,
      nextToken,
    });
  }

  if (existingRecord.status === 'RUNNING') {
    return buildPendingResponse(
      event,
      existingRecord.requestKey,
      existingRecord.queryExecutionId,
      existingRecord.aggregationLevel,
    );
  }

  return null;
};

const buildPendingSeriesResponse = (
  event: APIGatewayProxyEvent,
  existingRecord: {
    requestKey: string;
    queryExecutionId: string;
    aggregationLevel: '15m' | 'daily' | 'monthly';
  },
) => buildPendingResponse(
    event,
    existingRecord.requestKey,
    existingRecord.queryExecutionId,
    existingRecord.aggregationLevel,
  );

export const handleSeriesQuery = async (
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
        status: queryStateToRegistryStatus(QueryExecutionState.SUCCEEDED),
        updatedAt: nowIso(),
        expiresAt: expiresAtEpochSeconds(),
      });

      return buildSeriesSuccessResponse({
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

      return buildFailedResponse(
        event,
        existingRecord.requestKey,
        existingRecord.queryExecutionId,
        existingRecord.aggregationLevel,
        'The long-range query failed before results were ready. Retry the request or check back shortly.',
      );
    }

    return buildPendingResponse(
      event,
      existingRecord.requestKey,
      existingRecord.queryExecutionId,
      existingRecord.aggregationLevel,
    );
  }

  if (!hasSeriesRangeParams(validatedParameters)) {
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
    const reusableResponse = await buildExistingSeriesResponse(
      event,
      databaseService,
      requestKey,
      validatedParameters.nextToken,
      existingRecord,
    );
    if (reusableResponse) {
      return reusableResponse;
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

  const timestamp = nowIso();
  const created = await queryRegistry.create({
    requestKey,
    userKey,
    queryExecutionId,
    status: 'RUNNING',
    aggregationLevel: resolvedSeriesQuery.aggregationLevel,
    tableName: resolvedSeriesQuery.tableName,
    queryString: resolvedSeriesQuery.queryString,
    createdAt: timestamp,
    updatedAt: timestamp,
    expiresAt: expiresAtEpochSeconds(),
  });

  if (!created) {
    const latestRecord = await queryRegistry.get(requestKey);
    if (latestRecord) {
      const reusableResponse = await buildExistingSeriesResponse(
        event,
        databaseService,
        requestKey,
        validatedParameters.nextToken,
        latestRecord,
      );
      if (reusableResponse) {
        return reusableResponse;
      }

      return buildPendingSeriesResponse(event, latestRecord);
    }
  }

  const queryState = await databaseService.waitForQuery(queryExecutionId, {
    maxWaitMs: Math.min(FIVE_SECONDS_MS, context.getRemainingTimeInMillis() - 250),
    cancelOnTimeout: false,
  } as { maxWaitMs: number } & Record<string, boolean | number>);

  if (queryState === QueryExecutionState.SUCCEEDED) {
    await queryRegistry.update({
      requestKey,
      status: queryStateToRegistryStatus(QueryExecutionState.SUCCEEDED),
      updatedAt: nowIso(),
      expiresAt: expiresAtEpochSeconds(),
    });

    return buildSeriesSuccessResponse({
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

    return buildFailedResponse(
      event,
      requestKey,
      queryExecutionId,
      resolvedSeriesQuery.aggregationLevel,
      'The long-range query failed before results were ready. Retry the request or adjust the date range.',
    );
  }

  return buildPendingResponse(event, requestKey, queryExecutionId, resolvedSeriesQuery.aggregationLevel);
};
