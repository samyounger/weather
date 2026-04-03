import { NoSuchKey } from '@aws-sdk/client-s3';
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

  it('returns null when the object body is missing', async () => {
    send.mockResolvedValueOnce({});

    const subject = await new QueryRegistry('bucket-name', client).get('request-1');

    expect(subject).toBeNull();
  });

  it('reads a record from S3', async () => {
    send.mockResolvedValueOnce({
      Body: {
        transformToString: async () => JSON.stringify(record),
      },
    });

    const subject = await new QueryRegistry('bucket-name', client).get('request-1');

    expect(subject).toEqual(record);
  });

  it('returns null for expired records by default', async () => {
    send.mockResolvedValueOnce({
      Body: {
        transformToString: async () => JSON.stringify({
          ...record,
          expiresAt: Math.floor(Date.now() / 1000) - 10,
        }),
      },
    });

    const subject = await new QueryRegistry('bucket-name', client).get('request-1');

    expect(subject).toBeNull();
  });

  it('can read expired records when explicitly requested', async () => {
    const expiredRecord = {
      ...record,
      expiresAt: Math.floor(Date.now() / 1000) - 10,
    };
    send.mockResolvedValueOnce({
      Body: {
        transformToString: async () => JSON.stringify(expiredRecord),
      },
    });

    const subject = await new QueryRegistry('bucket-name', client).get('request-1', { includeExpired: true });

    expect(subject).toEqual(expiredRecord);
  });

  it('returns null when the key does not exist', async () => {
    const error = new NoSuchKey({ $metadata: {}, message: 'missing' });
    send.mockRejectedValueOnce(error);

    const subject = await new QueryRegistry('bucket-name', client).get('request-1');

    expect(subject).toBeNull();
  });

  it('rethrows unexpected S3 errors', async () => {
    send.mockRejectedValueOnce(new Error('boom'));

    await expect(new QueryRegistry('bucket-name', client).get('request-1')).rejects.toThrow('boom');
  });

  it('uses the default bucket name when one is not provided', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('missing'), { name: 'NoSuchKey' }));

    const subject = await new QueryRegistry(undefined, client).get('request-1');

    expect(subject).toBeNull();
  });

  it('returns null when the object body cannot be transformed into text', async () => {
    send.mockResolvedValueOnce({
      Body: {},
    });

    const subject = await new QueryRegistry('bucket-name', client).get('request-1');

    expect(subject).toBeNull();
  });

  it('creates a new record when one does not exist', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('missing'), { name: 'NoSuchKey' }))
      .mockResolvedValueOnce({});

    const subject = await new QueryRegistry('bucket-name', client).create(record);

    expect(subject).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('returns false from create when the record already exists', async () => {
    send.mockResolvedValueOnce({
      Body: {
        transformToString: async () => JSON.stringify(record),
      },
    });

    const subject = await new QueryRegistry('bucket-name', client).create(record);

    expect(subject).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('returns false from create when a concurrent writer wins the conditional put', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('missing'), { name: 'NoSuchKey' }))
      .mockRejectedValueOnce(Object.assign(new Error('precondition failed'), { name: 'PreconditionFailed' }));

    const subject = await new QueryRegistry('bucket-name', client).create(record);

    expect(subject).toBe(false);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('replaces an expired record during create', async () => {
    send.mockResolvedValueOnce({
      Body: {
        transformToString: async () => JSON.stringify({
          ...record,
          expiresAt: Math.floor(Date.now() / 1000) - 10,
        }),
      },
    }).mockResolvedValueOnce({});

    const subject = await new QueryRegistry('bucket-name', client).create(record);

    expect(subject).toBe(true);
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('updates an existing record', async () => {
    send
      .mockResolvedValueOnce({
        Body: {
          transformToString: async () => JSON.stringify(record),
        },
      })
      .mockResolvedValueOnce({});

    await new QueryRegistry('bucket-name', client).update({
      requestKey: 'request-1',
      status: 'SUCCEEDED',
      updatedAt: '2026-04-03T13:00:00.000Z',
      expiresAt: 67890,
    });

    expect(send).toHaveBeenCalledTimes(2);
  });

  it('skips update when there is no existing record', async () => {
    send.mockRejectedValueOnce(Object.assign(new Error('missing'), { name: 'NoSuchKey' }));

    await new QueryRegistry('bucket-name', client).update({
      requestKey: 'request-1',
      status: 'SUCCEEDED',
      updatedAt: '2026-04-03T13:00:00.000Z',
      expiresAt: 67890,
    });

    expect(send).toHaveBeenCalledTimes(1);
  });
});
