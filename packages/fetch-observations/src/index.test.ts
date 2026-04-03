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
    expect(subject.body).toContain('"requestKey":"request-1"');
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

  it('returns 404 for unsupported endpoint path', async () => {
    await callHandler({
      ...syncEvent,
      path: '/nope',
    } as APIGatewayProxyEvent);

    expect(subject.statusCode).toBe(404);
    expect(subject.body).toEqual(JSON.stringify({ error: 'Unsupported endpoint. Use /observations, /refined, or /series' }));
  });
});
