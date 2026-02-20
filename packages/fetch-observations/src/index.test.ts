import { handler } from './index';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";
import { QueryExecutionState } from '@aws-sdk/client-athena';

const mockDatabaseGetResults = jest.fn().mockResolvedValue(JSON.parse('{"ResultSet": {"Rows": [{"Data": [{"VarCharValue": "2020-01-01T00:00:00Z"}]}]}}'));
const mockDatabaseGetQueryState = jest.fn().mockResolvedValue(QueryExecutionState.SUCCEEDED);
const mockDatabaseQuery = jest.fn().mockResolvedValue({ QueryExecutionId: 'async-123' });
jest.mock('@weather/cloud-computing', () => ({
  Database: jest.fn().mockImplementation(() => ({
    query: mockDatabaseQuery,
    getResults: mockDatabaseGetResults,
    getQueryState: mockDatabaseGetQueryState,
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
} as unknown as APIGatewayProxyEvent;

describe('handler', () => {
  let subject: APIGatewayProxyResult;

  const callHandler = async (event: APIGatewayProxyEvent) => {
    const query = handler(event, mockContext);
    subject = await query;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabaseGetResults.mockResolvedValue(JSON.parse('{"ResultSet": {"Rows": [{"Data": [{"VarCharValue": "2020-01-01T00:00:00Z"}]}]}, "NextToken": "next-1"}'));
    mockDatabaseGetQueryState.mockResolvedValue(QueryExecutionState.SUCCEEDED);
    mockDatabaseQuery.mockResolvedValue({ QueryExecutionId: 'async-123' });
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
    });
  });

  it('returns 400 when query params are invalid', async () => {
    mockQueryParamValidatorValid.mockReturnValue(false);

    await callHandler(syncEvent);

    expect(subject.statusCode).toBe(400);
  });

  it('returns 500 when query preparation fails', async () => {
    mockQueryPreparationValid.mockReturnValue(false);

    await callHandler(syncEvent);

    expect(subject.statusCode).toBe(500);
  });

  it('returns 200 for sync success and includes nextToken', async () => {
    mockQueryPreparationValid.mockReturnValue(true);

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

  it('supports root path as observations endpoint', async () => {
    const rootEvent = {
      ...syncEvent,
      path: '/',
    };

    await callHandler(rootEvent);

    expect(subject.statusCode).toBe(200);
    expect(subject.body).toContain('"table":"observations"');
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
    mockDatabaseGetResults.mockResolvedValueOnce({ ResultSet: { Rows: [] } });

    await callHandler(syncEvent);

    expect(subject.statusCode).toBe(500);
    expect(subject.body).toEqual(JSON.stringify({ error: 'Failed to retrieve Athena query results' }));
  });

  it('starts async query and returns 202 with queryExecutionId', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({
      mode: 'async',
      from: new Date('2026-02-19T00:00:00Z'),
      to: new Date('2026-02-19T01:00:00Z'),
      fromEpochSeconds: 1771459200,
      toEpochSeconds: 1771462800,
      fields: ['datetime', 'winddirection'],
      limit: 100,
    });

    await callHandler(syncEvent);

    expect(subject.statusCode).toBe(202);
    expect(subject.body).toEqual(JSON.stringify({
      mode: 'async',
      table: 'observations',
      status: 'RUNNING',
      queryExecutionId: 'async-123',
    }));
  });

  it('returns 202 while async query is still running', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({ mode: 'async', queryExecutionId: 'async-123' });
    mockDatabaseGetQueryState.mockResolvedValue(QueryExecutionState.RUNNING);

    await callHandler(syncEvent);

    expect(subject.statusCode).toBe(202);
  });

  it('returns 200 with data when async query succeeds', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({ mode: 'async', queryExecutionId: 'async-123', nextToken: 'next-1' });
    mockDatabaseGetQueryState.mockResolvedValue(QueryExecutionState.SUCCEEDED);

    await callHandler(syncEvent);

    expect(subject.statusCode).toBe(200);
    expect(subject.body).toEqual(JSON.stringify({
      mode: 'async',
      table: 'observations',
      status: 'SUCCEEDED',
      queryExecutionId: 'async-123',
      nextToken: 'next-1',
      data: [['2020-01-01T00:00:00Z']],
    }));
  });

  it('starts async query on refined endpoint and returns 202 with queryExecutionId', async () => {
    const refinedEvent = {
      ...syncEvent,
      path: '/refined',
    };
    mockQueryParamValidatorValidated.mockReturnValue({
      mode: 'async',
      from: new Date('2026-02-19T00:00:00Z'),
      to: new Date('2026-02-19T01:00:00Z'),
      fromEpochSeconds: 1771459200,
      toEpochSeconds: 1771462800,
      fields: ['period_start', 'windavg_avg'],
      limit: 100,
    });

    await callHandler(refinedEvent);

    expect(subject.statusCode).toBe(202);
    expect(mockDatabaseQuery).toHaveBeenCalledWith(expect.stringContaining('FROM observations_refined_15m'));
    expect(subject.body).toEqual(JSON.stringify({
      mode: 'async',
      table: 'observations_refined_15m',
      status: 'RUNNING',
      queryExecutionId: 'async-123',
    }));
  });

  it('returns 404 for unsupported endpoint path', async () => {
    const unknownPathEvent = {
      ...syncEvent,
      path: '/nope',
    };

    await callHandler(unknownPathEvent);

    expect(subject.statusCode).toBe(404);
    expect(subject.body).toEqual(JSON.stringify({ error: 'Unsupported endpoint. Use /observations or /refined' }));
  });

  it('returns 500 when async query fails', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({ mode: 'async', queryExecutionId: 'async-123' });
    mockDatabaseGetQueryState.mockResolvedValue(QueryExecutionState.FAILED);

    await callHandler(syncEvent);

    expect(subject.statusCode).toBe(500);
  });

  it('returns 400 when async mode start does not include range params', async () => {
    mockQueryParamValidatorValidated.mockReturnValue({ mode: 'async' });

    await callHandler(syncEvent);

    expect(subject.statusCode).toBe(400);
    expect(subject.body).toEqual(JSON.stringify({ error: 'Async mode start requires from and to query parameters' }));
  });

  it('rethrows unexpected runtime errors', async () => {
    mockDatabaseGetResults.mockRejectedValueOnce(new Error('boom'));

    await expect(handler(syncEvent, mockContext)).rejects.toThrow('boom');
  });
});
