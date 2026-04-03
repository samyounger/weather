import {
  ConditionalCheckFailedException,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';

export type QueryRegistryStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export type QueryRegistryRecord = {
  requestKey: string;
  userKey: string;
  queryExecutionId: string;
  status: QueryRegistryStatus;
  aggregationLevel: '15m' | 'daily' | 'monthly';
  tableName: string;
  queryString: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: number;
};

const REGION = 'eu-west-2';

const toItem = (record: QueryRegistryRecord) => ({
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
});

const fromItem = (item: Record<string, { S?: string; N?: string }>): QueryRegistryRecord | null => {
  const requestKey = item.requestKey?.S;
  const userKey = item.userKey?.S;
  const queryExecutionId = item.queryExecutionId?.S;
  const status = item.status?.S as QueryRegistryStatus | undefined;
  const aggregationLevel = item.aggregationLevel?.S as QueryRegistryRecord['aggregationLevel'] | undefined;
  const tableName = item.tableName?.S;
  const queryString = item.queryString?.S;
  const createdAt = item.createdAt?.S;
  const updatedAt = item.updatedAt?.S;
  const expiresAt = item.expiresAt?.N ? Number(item.expiresAt.N) : undefined;

  if (
    !requestKey
    || !userKey
    || !queryExecutionId
    || !status
    || !aggregationLevel
    || !tableName
    || !queryString
    || !createdAt
    || !updatedAt
    || expiresAt === undefined
    || Number.isNaN(expiresAt)
  ) {
    return null;
  }

  return {
    requestKey,
    userKey,
    queryExecutionId,
    status,
    aggregationLevel,
    tableName,
    queryString,
    createdAt,
    updatedAt,
    expiresAt,
  };
};

export class QueryRegistry {
  public constructor(
    private readonly tableName = process.env.QUERY_REGISTRY_TABLE ?? 'tempest-fetch-observations-query-registry',
    private readonly client = new DynamoDBClient({ region: REGION }),
  ) {}

  public async get(requestKey: string, options?: { includeExpired?: boolean }): Promise<QueryRegistryRecord | null> {
    const response = await this.client.send(new GetItemCommand({
      TableName: this.tableName,
      Key: {
        requestKey: { S: requestKey },
      },
      ConsistentRead: true,
    }));

    if (!response.Item) {
      return null;
    }

    const record = fromItem(response.Item);
    if (!record) {
      return null;
    }

    if (!options?.includeExpired && this.isExpired(record)) {
      return null;
    }

    return record;
  }

  public async create(record: QueryRegistryRecord): Promise<boolean> {
    try {
      await this.client.send(new PutItemCommand({
        TableName: this.tableName,
        Item: toItem(record),
        ConditionExpression: 'attribute_not_exists(requestKey) OR expiresAt <= :now',
        ExpressionAttributeValues: {
          ':now': { N: String(Math.floor(Date.now() / 1000)) },
        },
      }));

      return true;
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException || (error as { name?: string }).name === 'ConditionalCheckFailedException') {
        return false;
      }

      throw error;
    }
  }

  public async update(record: Pick<QueryRegistryRecord, 'requestKey' | 'status' | 'updatedAt' | 'expiresAt'>): Promise<void> {
    try {
      await this.client.send(new UpdateItemCommand({
        TableName: this.tableName,
        Key: {
          requestKey: { S: record.requestKey },
        },
        ConditionExpression: 'attribute_exists(requestKey)',
        UpdateExpression: 'SET #status = :status, updatedAt = :updatedAt, expiresAt = :expiresAt',
        ExpressionAttributeNames: {
          '#status': 'status',
        },
        ExpressionAttributeValues: {
          ':status': { S: record.status },
          ':updatedAt': { S: record.updatedAt },
          ':expiresAt': { N: String(record.expiresAt) },
        },
      }));
    } catch (error) {
      if (error instanceof ConditionalCheckFailedException || (error as { name?: string }).name === 'ConditionalCheckFailedException') {
        return;
      }

      throw error;
    }
  }

  private isExpired(record: Pick<QueryRegistryRecord, 'expiresAt'>) {
    return record.expiresAt <= Math.floor(Date.now() / 1000);
  }
}
