import { GetObjectCommand, GetObjectCommandOutput, NoSuchKey, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

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

  public async get(requestKey: string): Promise<QueryRegistryRecord | null> {
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

      return JSON.parse(body) as QueryRegistryRecord;
    } catch (error) {
      if (error instanceof NoSuchKey || (error as { name?: string }).name === 'NoSuchKey') {
        return null;
      }

      throw error;
    }
  }

  public async create(record: QueryRegistryRecord): Promise<boolean> {
    const existing = await this.get(record.requestKey);
    if (existing) {
      return false;
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

  private async put(record: QueryRegistryRecord): Promise<void> {
    await this.client.send(new PutObjectCommand({
      Bucket: this.bucketName,
      Key: this.keyFor(record.requestKey),
      Body: JSON.stringify(record),
      ContentType: 'application/json',
    }));
  }

  private keyFor(requestKey: string) {
    return `${REGISTRY_PREFIX}/${requestKey}.json`;
  }
}
