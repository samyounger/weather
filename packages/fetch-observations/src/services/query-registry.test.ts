import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { QueryRegistry } from './query-registry';

describe('QueryRegistry', () => {
  const send = jest.fn();
  const client = { send } as never;
  const record = {
    requestKey: 'request-1',
    userKey: 'user-1',
    queryExecutionId: 'query-1',
    status: 'RUNNING' as const,
    aggregationLevel: 'daily' as const,
    tableName: 'observations_refined_daily',
    queryString: 'SELECT 1',
    createdAt: '2026-04-03T12:00:00.000Z',
    updatedAt: '2026-04-03T12:00:00.000Z',
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
  };

  beforeEach(() => {
    send.mockReset();
  });

  it('returns null when the item is missing', async () => {
    send.mockResolvedValueOnce({});

    const subject = await new QueryRegistry('table-name', client).get('request-1');

    expect(subject).toBeNull();
  });

  it('reads a record from DynamoDB', async () => {
    send.mockResolvedValueOnce({
      Item: {
        requestKey: { S: record.requestKey },
        userKey: { S: record.userKey },
        queryExecutionId: { S: record.queryExecutionId },
        status: { S: record.status },
        aggregationLevel: { S: record.aggregationLevel },
        tableName: { S: record.tableName },
        queryString: { S: record.queryString },
        createdAt: { S: record.createdAt },
        updatedAt: { S: record.updatedAt },
        expiresAt: { N: String(record.expiresAt) },
      },
    });

    const subject = await new QueryRegistry('table-name', client).get('request-1');

    expect(subject).toEqual(record);
  });

  it('returns null for malformed items', async () => {
    send.mockResolvedValueOnce({
      Item: {
        requestKey: { S: record.requestKey },
      },
    });

    const subject = await new QueryRegistry('table-name', client).get('request-1');

    expect(subject).toBeNull();
  });

  it('returns null for expired records by default', async () => {
    send.mockResolvedValueOnce({
      Item: {
        requestKey: { S: record.requestKey },
        userKey: { S: record.userKey },
        queryExecutionId: { S: record.queryExecutionId },
        status: { S: record.status },
        aggregationLevel: { S: record.aggregationLevel },
        tableName: { S: record.tableName },
        queryString: { S: record.queryString },
        createdAt: { S: record.createdAt },
        updatedAt: { S: record.updatedAt },
        expiresAt: { N: String(Math.floor(Date.now() / 1000) - 10) },
      },
    });

    const subject = await new QueryRegistry('table-name', client).get('request-1');

    expect(subject).toBeNull();
  });

  it('can read expired records when explicitly requested', async () => {
    const expiredAt = Math.floor(Date.now() / 1000) - 10;
    send.mockResolvedValueOnce({
      Item: {
        requestKey: { S: record.requestKey },
        userKey: { S: record.userKey },
        queryExecutionId: { S: record.queryExecutionId },
        status: { S: record.status },
        aggregationLevel: { S: record.aggregationLevel },
        tableName: { S: record.tableName },
        queryString: { S: record.queryString },
        createdAt: { S: record.createdAt },
        updatedAt: { S: record.updatedAt },
        expiresAt: { N: String(expiredAt) },
      },
    });

    const subject = await new QueryRegistry('table-name', client).get('request-1', { includeExpired: true });

    expect(subject).toEqual({
      ...record,
      expiresAt: expiredAt,
    });
  });

  it('creates a new record when the conditional put succeeds', async () => {
    send.mockResolvedValueOnce({});

    const subject = await new QueryRegistry('table-name', client).create(record);

    expect(subject).toBe(true);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('returns false from create when a non-expired record already exists', async () => {
    send.mockRejectedValueOnce(new ConditionalCheckFailedException({ $metadata: {}, message: 'exists' }));

    const subject = await new QueryRegistry('table-name', client).create(record);

    expect(subject).toBe(false);
  });

  it('returns false from create when a concurrent writer wins the put', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('exists'), { name: 'ConditionalCheckFailedException' }));

    const subject = await new QueryRegistry('table-name', client).create(record);

    expect(subject).toBe(false);
  });

  it('updates an existing record', async () => {
    send.mockResolvedValueOnce({});

    await new QueryRegistry('table-name', client).update({
      requestKey: 'request-1',
      status: 'SUCCEEDED',
      updatedAt: '2026-04-03T13:00:00.000Z',
      expiresAt: Math.floor(Date.now() / 1000) + 7200,
    });

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('skips update when there is no existing record', async () => {
    send.mockRejectedValueOnce(new ConditionalCheckFailedException({ $metadata: {}, message: 'missing' }));

    await new QueryRegistry('table-name', client).update({
      requestKey: 'request-1',
      status: 'SUCCEEDED',
      updatedAt: '2026-04-03T13:00:00.000Z',
      expiresAt: Math.floor(Date.now() / 1000) + 7200,
    });

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('uses the default table name when one is not provided', async () => {
    send.mockResolvedValueOnce({});

    const subject = await new QueryRegistry(undefined, client).get('request-1');

    expect(subject).toBeNull();
  });

  it('rethrows unexpected DynamoDB errors', async () => {
    send.mockRejectedValueOnce(new Error('boom'));

    await expect(new QueryRegistry('table-name', client).get('request-1')).rejects.toThrow('boom');
  });
});
