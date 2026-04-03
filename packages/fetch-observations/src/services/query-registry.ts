import {
  GetObjectCommand,
  GetObjectCommandOutput,
  NoSuchKey,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

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
const REGISTRY_PREFIX = 'query-registry';

const toBodyString = async (body: NonNullable<GetObjectCommandOutput['Body']>) => {
  if (typeof body.transformToString === 'function') {
    return await body.transformToString();
  }

  return '';
};

export class QueryRegistry {
  public constructor(
    private readonly bucketName = process.env.QUERY_REGISTRY_BUCKET ?? 'weather-tempest-records',
    private readonly client = new S3Client({ region: REGION }),
  ) {}

  public async get(requestKey: string, options?: { includeExpired?: boolean }): Promise<QueryRegistryRecord | null> {
    try {
      const response = await this.client.send(new GetObjectCommand({
        Bucket: this.bucketName,
        Key: this.keyFor(requestKey),
      }));

      if (!response.Body) {
        return null;
      }

      const body = await toBodyString(response.Body);
      if (!body) {
        return null;
      }

      const record = JSON.parse(body) as QueryRegistryRecord;
      if (!options?.includeExpired && this.isExpired(record)) {
        return null;
      }

      return record;
    } catch (error) {
      if (error instanceof NoSuchKey || (error as { name?: string }).name === 'NoSuchKey') {
        return null;
      }

      throw error;
    }
  }

  public async create(record: QueryRegistryRecord): Promise<boolean> {
    const existing = await this.get(record.requestKey, { includeExpired: true });
    if (existing && !this.isExpired(existing)) {
      return false;
    }

    if (!existing) {
      const created = await this.put(record, { onlyIfMissing: true });
      if (!created) {
        return false;
      }

      return true;
    }

    await this.put(record);
    return true;
  }

  public async update(record: Pick<QueryRegistryRecord, 'requestKey' | 'status' | 'updatedAt' | 'expiresAt'>): Promise<void> {
    const existing = await this.get(record.requestKey);
    if (!existing) {
      return;
    }

    await this.put({
      ...existing,
      status: record.status,
      updatedAt: record.updatedAt,
      expiresAt: record.expiresAt,
    });
  }

  private async put(record: QueryRegistryRecord, options?: { onlyIfMissing?: boolean }): Promise<boolean> {
    try {
      await this.client.send(new PutObjectCommand({
        Bucket: this.bucketName,
        Key: this.keyFor(record.requestKey),
        Body: JSON.stringify(record),
        ContentType: 'application/json',
        IfNoneMatch: options?.onlyIfMissing ? '*' : undefined,
      }));
      return true;
    } catch (error) {
      if (options?.onlyIfMissing && (error as { name?: string }).name === 'PreconditionFailed') {
        return false;
      }

      throw error;
    }
  }

  private keyFor(requestKey: string) {
    return `${REGISTRY_PREFIX}/${requestKey}.json`;
  }

  private isExpired(record: Pick<QueryRegistryRecord, 'expiresAt'>) {
    return record.expiresAt <= Math.floor(Date.now() / 1000);
  }
}
