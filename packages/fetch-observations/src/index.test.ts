import { handler } from './index';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { QueryExecutionState } from '@aws-sdk/client-athena';

const mockDatabaseGetResults = jest.fn().mockResolvedValue(JSON.parse('{"ResultSet": {"Rows": [{"Data": [{"VarCharValue": "2020-01-01T00:00:00Z"}]}]}, "NextToken": "next-1"}'));
const mockDatabaseGetQueryState = jest.fn().mockResolvedValue(QueryExecutionState.SUCCEEDED);
const mockDatabaseQuery = jest.fn().mockResolvedValue({ QueryExecutionId: 'async-123' });
const mockDatabaseWaitForQuery = jest.fn().mockResolvedValue(QueryExecutionState.SUCCEEDED);
const mockRegistryGet = jest.fn().mockResolvedValue(null);
const mockRegistryCreate = jest.fn().mockResolvedValue(true);
const mockRegistryUpdate = jest.fn().mockResolvedValue(undefined);

jest.mock('@weather/cloud-computing', () => ({
  Database: jest.fn().mockImplementation(() => ({
    query: mockDatabaseQuery,
    getResults: mockDatabaseGetResults,
    getQueryState: mockDatabaseGetQueryState,
    waitForQuery: mockDatabaseWaitForQuery,
  })),
}));

jest.mock('./services/query-registry', () => ({
  QueryRegistry: jest.fn().mockImplementation(() => ({
    get: mockRegistryGet,
    create: mockRegistryCreate,
    update: mockRegistryUpdate,
  })),
}));

const mockQueryParamValidatorValid = jest.fn().mockReturnValue(true);
const mockQueryParamValidatorErrorMessage = jest.fn().mockReturnValue('Mock error message one');
const mockQueryParamValidatorValidated = jest.fn().mockReturnValue({
  mode: 'sync',
  from: new Date('2026-02-19T00:00:00Z'),
  to: new Date('2026-02-19T01:00:00Z'),
  fromEpochSeconds: 1771459200,
  toEpochSeconds: 1771462800,
  fields: ['datetime', 'winddirection'],
  limit: 100,
  resolution: 'auto',
});
jest.mock('./services/query-string-param-validator', () => ({
  QueryStringParamValidator: jest.fn().mockImplementation(() => ({
    valid: mockQueryParamValidatorValid,
    returnError: mockQueryParamValidatorErrorMessage,
    validated: mockQueryParamValidatorValidated,
  })),
}));

const mockQueryPreparationValid = jest.fn().mockReturnValue(true);
const mockQueryPreparationResponseText = jest.fn().mockReturnValue('Mock error message two');
const mockQueryPreparationId = jest.fn().mockReturnValue({ QueryExecutionId: '123' });
jest.mock('./services/query-preparation', () => ({
  QueryPreparation: jest.fn().mockImplementation(() => ({
    queryResponse: mockQueryPreparationId(),
    valid: mockQueryPreparationValid,
    responseText: mockQueryPreparationResponseText,
  }))
}));

const mockContext: Context = {
  getRemainingTimeInMillis: () => 60000,
} as Context;

const syncEvent: APIGatewayProxyEvent = {
  path: '/observations',
  queryStringParameters: {
    from: '2026-02-19T00:00:00Z',
    to: '2026-02-19T01:00:00Z',
    fields: 'datetime,winddirection',
    limit: '100',
  },
  requestContext: {
    domainName: 'example.execute-api.eu-west-2.amazonaws.com',
    stage: '$default',
    authorizer: {
      jwt: {
        claims: {
          sub: 'user-123',
        },
      },
    },
  },
} as unknown as APIGatewayProxyEvent;

describe('handler', () => {
  let subject: APIGatewayProxyResult;

  const callHandler = async (event: APIGatewayProxyEvent) => {
    subject = await handler(event, mockContext);
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabaseGetResults.mockResolvedValue(JSON.parse('{"ResultSet": {"Rows": [{"Data": [{"VarCharValue": "2020-01-01T00:00:00Z"}]}]}, "NextToken": "next-1"}'));
    mockDatabaseGetQueryState.mockResolvedValue(QueryExecutionState.SUCCEEDED);
    mockDatabaseQuery.mockResolvedValue({ QueryExecutionId: 'async-123' });
    mockDatabaseWaitForQuery.mockResolvedValue(QueryExecutionState.SUCCEEDED);
    mockRegistryGet.mockResolvedValue(null);
    mockRegistryCreate.mockResolvedValue(true);
    mockQueryParamValidatorValid.mockReturnValue(true);
    mockQueryParamValidatorValidated.mockReturnValue({
      mode: 'sync',
      from: new Date('2026-02-19T00:00:00Z'),
      to: new Date('2026-02-19T01:00:00Z'),
      fromEpochSeconds: 1771459200,
      toEpochSeconds: 1771462800,
      fields: ['datetime', 'winddirection'],
      limit: 100,
      nextToken: 'next-1',
      resolution: 'auto',
    });
  });

  it('returns 400 when query params are invalid', async () => {
    mockQueryParamValidatorValid.mockReturnValue(false);

    await callHandler(syncEvent);

    expect(subject.statusCode).toBe(400);
  });

  it('returns 200 for sync success and includes nextToken', async () => {
    await callHandler(syncEvent);

    expect(subject.statusCode).toBe(200);
    expect(subject.body).toEqual(JSON.stringify({
      mode: 'sync',
      table: 'observations',
      queryExecutionId: '123',
      nextToken: 'next-1',
      parameters: {
        ...syncEvent.queryStringParameters,
      },
      data: [['2020-01-01T00:00:00Z']],
    }));
  });

  it('supports rawPath when present on the event', async () => {
    await callHandler({
      ...syncEvent,
      path: '/ignored',
      rawPath: '/observations',
    } as APIGatewayProxyEvent & { rawPath: string });

    expect(subject.statusCode).toBe(200);
  });

  it('returns 500 when query preparation fails', async () => {
    mockQueryPreparationValid.mockReturnValue(false);

    await callHandler(syncEvent);

    expect(subject.statusCode).toBe(500);
    expect(subject.body).toEqual(JSON.stringify({ error: 'Mock error message two' }));
  });

  it('returns 400 when validated query params are unavailable', async () => {
    mockQueryParamValidatorValidated.mockReturnValue(undefined);

    await callHandler(syncEvent);

    expect(subject.statusCode).toBe(400);
    expect(subject.body).toEqual(JSON.stringify({ error: 'Unable to parse query parameters' }));
  });

  it('returns 400 when sync mode is missing date range params', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({ mode: 'sync' });

    await callHandler(syncEvent);

    expect(subject.statusCode).toBe(400);
    expect(subject.body).toEqual(JSON.stringify({ error: 'Sync mode requires from and to query parameters' }));
  });

  it('returns 500 when sync result set is empty', async () => {
    mockQueryPreparationValid.mockReturnValue(true);
    mockDatabaseGetResults.mockResolvedValueOnce({ ResultSet: { Rows: [] } });

    await callHandler(syncEvent);

    expect(subject.statusCode).toBe(500);
    expect(subject.body).toEqual(JSON.stringify({ error: 'Failed to retrieve Athena query results' }));
  });

  it('returns 200 with cached data for succeeded series queries', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({
      mode: 'sync',
      from: new Date('2024-02-19T00:00:00Z'),
      to: new Date('2026-02-19T01:00:00Z'),
      fromEpochSeconds: 1708300800,
      toEpochSeconds: 1771462800,
      fields: ['period_start', 'airtemperature_avg'],
      limit: 100,
      nextToken: 'next-1',
      resolution: 'auto',
    });
    mockRegistryGet.mockResolvedValue({
      requestKey: 'request-1',
      queryExecutionId: 'async-123',
      status: 'SUCCEEDED',
      aggregationLevel: 'monthly',
      tableName: 'observations_refined_daily',
    });

    await callHandler({
      ...syncEvent,
      path: '/series',
    } as APIGatewayProxyEvent);

    expect(subject.statusCode).toBe(200);
    expect(subject.body).toContain('"requestKey":"');
    expect(subject.body).toContain('"aggregationLevel":"monthly"');
  });

  it('returns 202 for in-flight series queries without starting a second Athena query', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({
      mode: 'sync',
      from: new Date('2024-02-19T00:00:00Z'),
      to: new Date('2026-02-19T01:00:00Z'),
      fromEpochSeconds: 1708300800,
      toEpochSeconds: 1771462800,
      fields: ['period_start', 'airtemperature_avg'],
      limit: 100,
      resolution: 'auto',
    });
    mockRegistryGet.mockResolvedValue({
      requestKey: 'request-1',
      queryExecutionId: 'async-123',
      status: 'RUNNING',
      aggregationLevel: 'monthly',
      tableName: 'observations_refined_daily',
    });

    await callHandler({
      ...syncEvent,
      path: '/series',
    } as APIGatewayProxyEvent);

    expect(subject.statusCode).toBe(202);
    expect(mockDatabaseQuery).not.toHaveBeenCalled();
  });

  it('starts a new async-capable series query and returns pending when it exceeds the sync budget', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({
      mode: 'sync',
      from: new Date('2024-02-19T00:00:00Z'),
      to: new Date('2026-02-19T01:00:00Z'),
      fromEpochSeconds: 1708300800,
      toEpochSeconds: 1771462800,
      fields: ['period_start', 'airtemperature_avg'],
      limit: 100,
      resolution: 'auto',
    });
    mockDatabaseWaitForQuery.mockResolvedValue(undefined);

    await callHandler({
      ...syncEvent,
      path: '/series',
    } as APIGatewayProxyEvent);

    expect(subject.statusCode).toBe(202);
    expect(subject.body).toContain('"status":"PENDING"');
    expect(mockDatabaseQuery).toHaveBeenCalled();
  });

  it('supports polling by requestKey for series queries', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({
      mode: 'async',
      requestKey: 'request-1',
    });
    mockRegistryGet.mockResolvedValue({
      requestKey: 'request-1',
      queryExecutionId: 'async-123',
      status: 'RUNNING',
      aggregationLevel: 'monthly',
      tableName: 'observations_refined_daily',
    });
    mockDatabaseGetQueryState.mockResolvedValue(QueryExecutionState.RUNNING);

    await callHandler({
      ...syncEvent,
      path: '/series',
    } as APIGatewayProxyEvent);

    expect(subject.statusCode).toBe(202);
    expect(subject.body).toContain('"requestKey":"request-1"');
  });

  it('builds a relative poll url when the request context has no domain name', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({
      mode: 'async',
      requestKey: 'request-1',
    });
    mockRegistryGet.mockResolvedValue({
      requestKey: 'request-1',
      queryExecutionId: 'async-123',
      status: 'RUNNING',
      aggregationLevel: 'monthly',
      tableName: 'observations_refined_daily',
    });
    mockDatabaseGetQueryState.mockResolvedValue(QueryExecutionState.RUNNING);

    await callHandler({
      ...syncEvent,
      path: '/series',
      requestContext: {
        ...syncEvent.requestContext,
        domainName: undefined,
      },
    } as unknown as APIGatewayProxyEvent);

    expect(subject.body).toContain('/series?mode=async&requestKey=request-1');
  });

  it('includes a non-default stage in the series poll url', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({
      mode: 'async',
      requestKey: 'request-1',
    });
    mockRegistryGet.mockResolvedValue({
      requestKey: 'request-1',
      queryExecutionId: 'async-123',
      status: 'RUNNING',
      aggregationLevel: 'monthly',
      tableName: 'observations_refined_daily',
    });
    mockDatabaseGetQueryState.mockResolvedValue(QueryExecutionState.RUNNING);

    await callHandler({
      ...syncEvent,
      path: '/series',
      requestContext: {
        ...syncEvent.requestContext,
        stage: 'prod',
      },
    } as unknown as APIGatewayProxyEvent);

    expect(subject.body).toContain('https://example.execute-api.eu-west-2.amazonaws.com/prod/series?mode=async&requestKey=request-1');
  });

  it('returns a succeeded series payload when Athena reports success during polling', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({
      mode: 'async',
      requestKey: 'request-1',
      nextToken: 'next-1',
    });
    mockRegistryGet.mockResolvedValue({
      requestKey: 'request-1',
      queryExecutionId: 'async-123',
      status: 'RUNNING',
      aggregationLevel: 'monthly',
      tableName: 'observations_refined_daily',
    });
    mockDatabaseGetQueryState.mockResolvedValue(QueryExecutionState.SUCCEEDED);

    await callHandler({
      ...syncEvent,
      path: '/series',
    } as APIGatewayProxyEvent);

    expect(subject.statusCode).toBe(200);
    expect(subject.body).toContain('"status":"SUCCEEDED"');
  });

  it('returns a succeeded series payload when the registry already marks it complete', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({
      mode: 'async',
      requestKey: 'request-1',
      nextToken: 'next-1',
    });
    mockRegistryGet.mockResolvedValue({
      requestKey: 'request-1',
      queryExecutionId: 'async-123',
      status: 'SUCCEEDED',
      aggregationLevel: 'monthly',
      tableName: 'observations_refined_daily',
    });
    mockDatabaseGetQueryState.mockResolvedValue(QueryExecutionState.RUNNING);

    await callHandler({
      ...syncEvent,
      path: '/series',
    } as APIGatewayProxyEvent);

    expect(subject.statusCode).toBe(200);
    expect(subject.body).toContain('"status":"SUCCEEDED"');
  });

  it('returns 404 when polling a missing requestKey', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({
      mode: 'async',
      requestKey: 'missing-request',
    });
    mockRegistryGet.mockResolvedValue(null);

    await callHandler({
      ...syncEvent,
      path: '/series',
    } as APIGatewayProxyEvent);

    expect(subject.statusCode).toBe(404);
  });

  it('returns 500 when a polled series query fails', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({
      mode: 'async',
      requestKey: 'request-1',
    });
    mockRegistryGet.mockResolvedValue({
      requestKey: 'request-1',
      queryExecutionId: 'async-123',
      status: 'RUNNING',
      aggregationLevel: 'monthly',
      tableName: 'observations_refined_daily',
    });
    mockDatabaseGetQueryState.mockResolvedValue(QueryExecutionState.FAILED);

    await callHandler({
      ...syncEvent,
      path: '/series',
    } as APIGatewayProxyEvent);

    expect(subject.statusCode).toBe(500);
    expect(subject.body).toContain('"status":"FAILED"');
  });

  it('returns 400 when a series sync request is missing range params', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({ mode: 'sync' });

    await callHandler({
      ...syncEvent,
      path: '/series',
    } as APIGatewayProxyEvent);

    expect(subject.statusCode).toBe(400);
    expect(subject.body).toEqual(JSON.stringify({ error: 'Series queries require from and to query parameters' }));
  });

  it('returns 500 when a series query cannot start in Athena', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({
      mode: 'sync',
      from: new Date('2024-02-19T00:00:00Z'),
      to: new Date('2026-02-19T01:00:00Z'),
      fromEpochSeconds: 1708300800,
      toEpochSeconds: 1771462800,
      fields: ['period_start', 'airtemperature_avg'],
      limit: 100,
      resolution: 'auto',
    });
    mockDatabaseQuery.mockResolvedValueOnce({ QueryExecutionId: undefined });

    await callHandler({
      ...syncEvent,
      path: '/series',
    } as APIGatewayProxyEvent);

    expect(subject.statusCode).toBe(500);
    expect(subject.body).toEqual(JSON.stringify({ error: 'Failed to execute Athena query' }));
  });

  it('returns the latest pending record when another request won the create race', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({
      mode: 'sync',
      from: new Date('2024-02-19T00:00:00Z'),
      to: new Date('2026-02-19T01:00:00Z'),
      fromEpochSeconds: 1708300800,
      toEpochSeconds: 1771462800,
      fields: ['period_start', 'airtemperature_avg'],
      limit: 100,
      resolution: 'auto',
    });
    mockRegistryCreate.mockResolvedValue(false);
    mockRegistryGet
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        requestKey: 'request-1',
        queryExecutionId: 'async-123',
        status: 'RUNNING',
        aggregationLevel: 'monthly',
        tableName: 'observations_refined_daily',
      });

    await callHandler({
      ...syncEvent,
      path: '/series',
    } as APIGatewayProxyEvent);

    expect(subject.statusCode).toBe(202);
    expect(subject.body).toContain('"status":"PENDING"');
  });

  it('returns the latest succeeded record when another request won the create race', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({
      mode: 'sync',
      from: new Date('2024-02-19T00:00:00Z'),
      to: new Date('2026-02-19T01:00:00Z'),
      fromEpochSeconds: 1708300800,
      toEpochSeconds: 1771462800,
      fields: ['period_start', 'airtemperature_avg'],
      limit: 100,
      resolution: 'auto',
    });
    mockRegistryCreate.mockResolvedValue(false);
    mockRegistryGet
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        requestKey: 'request-1',
        queryExecutionId: 'async-123',
        status: 'SUCCEEDED',
        aggregationLevel: 'monthly',
        tableName: 'observations_refined_daily',
      });

    await callHandler({
      ...syncEvent,
      path: '/series',
    } as APIGatewayProxyEvent);

    expect(subject.statusCode).toBe(200);
    expect(subject.body).toContain('"status":"SUCCEEDED"');
  });

  it('continues to pending when the create race loses and the latest record is unavailable', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({
      mode: 'sync',
      from: new Date('2024-02-19T00:00:00Z'),
      to: new Date('2026-02-19T01:00:00Z'),
      fromEpochSeconds: 1708300800,
      toEpochSeconds: 1771462800,
      fields: ['period_start', 'airtemperature_avg'],
      limit: 100,
      resolution: 'auto',
    });
    mockRegistryCreate.mockResolvedValue(false);
    mockRegistryGet.mockResolvedValue(null);
    mockDatabaseWaitForQuery.mockResolvedValue(undefined);

    await callHandler({
      ...syncEvent,
      path: '/series',
    } as APIGatewayProxyEvent);

    expect(subject.statusCode).toBe(202);
    expect(subject.body).toContain('"status":"PENDING"');
  });

  it('returns series data immediately when the Athena query completes within the sync budget', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({
      mode: 'sync',
      from: new Date('2024-02-19T00:00:00Z'),
      to: new Date('2026-02-19T01:00:00Z'),
      fromEpochSeconds: 1708300800,
      toEpochSeconds: 1771462800,
      fields: ['period_start', 'airtemperature_avg'],
      limit: 100,
      resolution: 'auto',
      nextToken: 'next-1',
    });
    mockDatabaseWaitForQuery.mockResolvedValue(QueryExecutionState.SUCCEEDED);

    await callHandler({
      ...syncEvent,
      path: '/series',
    } as APIGatewayProxyEvent);

    expect(subject.statusCode).toBe(200);
    expect(subject.body).toContain('"status":"SUCCEEDED"');
  });

  it('uses the 15 minute query path for short explicit series ranges', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({
      mode: 'sync',
      from: new Date('2026-02-19T00:00:00Z'),
      to: new Date('2026-02-19T01:00:00Z'),
      fromEpochSeconds: 1771459200,
      toEpochSeconds: 1771462800,
      fields: ['period_start', 'airtemperature_avg'],
      limit: 100,
      resolution: '15m',
      nextToken: 'next-1',
    });
    mockDatabaseWaitForQuery.mockResolvedValue(QueryExecutionState.SUCCEEDED);

    await callHandler({
      ...syncEvent,
      path: '/series',
      requestContext: {
        ...syncEvent.requestContext,
        authorizer: {
          jwt: {
            claims: {
              email: 'user@example.com',
            },
          },
        },
      },
    } as unknown as APIGatewayProxyEvent);

    expect(subject.statusCode).toBe(200);
    expect(mockDatabaseQuery).toHaveBeenCalledWith(expect.stringContaining('FROM observations_refined_15m'));
  });

  it('uses the daily query path for medium explicit series ranges with anonymous fallback', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({
      mode: 'sync',
      from: new Date('2026-02-01T00:00:00Z'),
      to: new Date('2026-03-15T01:00:00Z'),
      fromEpochSeconds: 1770000000,
      toEpochSeconds: 1773000000,
      fields: ['period_start', 'airtemperature_avg'],
      limit: 100,
      resolution: 'daily',
      nextToken: 'next-1',
    });
    mockDatabaseWaitForQuery.mockResolvedValue(QueryExecutionState.SUCCEEDED);

    await callHandler({
      ...syncEvent,
      path: '/series',
      requestContext: {
        ...syncEvent.requestContext,
        authorizer: undefined,
      },
    } as unknown as APIGatewayProxyEvent);

    expect(subject.statusCode).toBe(200);
    expect(mockDatabaseQuery).toHaveBeenCalledWith(expect.stringContaining('FROM observations_refined_daily'));
  });

  it('returns 500 when the series Athena query ends cancelled within the sync budget', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({
      mode: 'sync',
      from: new Date('2024-02-19T00:00:00Z'),
      to: new Date('2026-02-19T01:00:00Z'),
      fromEpochSeconds: 1708300800,
      toEpochSeconds: 1771462800,
      fields: ['period_start', 'airtemperature_avg'],
      limit: 100,
      resolution: 'auto',
    });
    mockDatabaseWaitForQuery.mockResolvedValue(QueryExecutionState.CANCELLED);

    await callHandler({
      ...syncEvent,
      path: '/series',
    } as APIGatewayProxyEvent);

    expect(subject.statusCode).toBe(500);
    expect(subject.body).toContain('"status":"FAILED"');
  });

  it('returns 500 when async polling reports a cancelled standard Athena query', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({ mode: 'async', queryExecutionId: 'async-123' });
    mockDatabaseGetQueryState.mockResolvedValue(QueryExecutionState.CANCELLED);

    await callHandler(syncEvent);

    expect(subject.statusCode).toBe(500);
  });

  it('returns 202 while a standard async Athena query is still running', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({ mode: 'async', queryExecutionId: 'async-123' });
    mockDatabaseGetQueryState.mockResolvedValue(QueryExecutionState.RUNNING);

    await callHandler(syncEvent);

    expect(subject.statusCode).toBe(202);
  });

  it('returns 200 with data when a standard async Athena query succeeds', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({ mode: 'async', queryExecutionId: 'async-123', nextToken: 'next-1' });
    mockDatabaseGetQueryState.mockResolvedValue(QueryExecutionState.SUCCEEDED);

    await callHandler(syncEvent);

    expect(subject.statusCode).toBe(200);
    expect(subject.body).toContain('"status":"SUCCEEDED"');
  });

  it('returns 500 when a standard async Athena query fails', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({ mode: 'async', queryExecutionId: 'async-123' });
    mockDatabaseGetQueryState.mockResolvedValue(QueryExecutionState.FAILED);

    await callHandler(syncEvent);

    expect(subject.statusCode).toBe(500);
  });

  it('starts a standard async Athena query for observations', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({
      mode: 'async',
      from: new Date('2026-02-19T00:00:00Z'),
      to: new Date('2026-02-19T01:00:00Z'),
      fromEpochSeconds: 1771459200,
      toEpochSeconds: 1771462800,
      fields: ['datetime', 'winddirection'],
      limit: 100,
      resolution: 'auto',
    });

    await callHandler(syncEvent);

    expect(subject.statusCode).toBe(202);
    expect(subject.body).toContain('"status":"RUNNING"');
  });

  it('returns 400 when async mode start does not include range params', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({ mode: 'async' });

    await callHandler(syncEvent);

    expect(subject.statusCode).toBe(400);
    expect(subject.body).toEqual(JSON.stringify({ error: 'Async mode start requires from and to query parameters' }));
  });

  it('starts async query on refined endpoint and returns 202 with queryExecutionId', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({
      mode: 'async',
      from: new Date('2026-02-19T00:00:00Z'),
      to: new Date('2026-02-19T01:00:00Z'),
      fromEpochSeconds: 1771459200,
      toEpochSeconds: 1771462800,
      fields: ['period_start', 'windavg_avg'],
      limit: 100,
      resolution: 'auto',
    });

    await callHandler({
      ...syncEvent,
      path: '/refined',
    } as APIGatewayProxyEvent);

    expect(subject.statusCode).toBe(202);
    expect(mockDatabaseQuery).toHaveBeenCalledWith(expect.stringContaining('FROM observations_refined_15m'));
  });

  it('returns 404 for unsupported endpoint path', async () => {
    await callHandler({
      ...syncEvent,
      path: '/nope',
    } as APIGatewayProxyEvent);

    expect(subject.statusCode).toBe(404);
    expect(subject.body).toEqual(JSON.stringify({ error: 'Unsupported endpoint. Use /observations, /refined, or /series' }));
  });

  it('rethrows unexpected runtime errors', async () => {
    mockQueryPreparationValid.mockReturnValue(true);
    mockDatabaseGetResults.mockRejectedValueOnce(new Error('boom'));

    await expect(handler(syncEvent, mockContext)).rejects.toThrow('boom');
  });
});
