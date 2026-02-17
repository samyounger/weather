import { ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export type Partition = {
  year: string;
  month: string;
  day: string;
  hour: string;
};

type PlannerInput = {
  bucket?: string;
  prefix?: string;
  chunkSize?: number;
  outputPrefix?: string;
  maxConcurrency?: number;
};

type PlannerOutput = {
  bucket: string;
  outputPrefix: string;
  manifestKey: string;
  totalPartitions: number;
  totalChunks: number;
  chunkKeys: string[];
  maxConcurrency?: number;
};

const DEFAULT_BUCKET = process.env.BACKFILL_BUCKET || 'weather-tempest-records';
const DEFAULT_PREFIX = process.env.BACKFILL_SCAN_PREFIX || '';
const DEFAULT_OUTPUT_PREFIX = process.env.BACKFILL_OUTPUT_PREFIX || 'backfill/athena-partitions';
const DEFAULT_CHUNK_SIZE = Number(process.env.BACKFILL_CHUNK_SIZE || '100');

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'eu-west-2' });

const partitionPattern = /year=(\d{4})\/month=(\d{2})\/day=(\d{2})\/hour=(\d{2})\//;

const partitionKey = (partition: Partition): string => (
  `${partition.year}-${partition.month}-${partition.day}-${partition.hour}`
);

const partitionSortKey = (partition: Partition): number => (
  Number(`${partition.year}${partition.month}${partition.day}${partition.hour}`)
);

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const listPartitionKeys = async (bucket: string, prefix: string): Promise<Set<string>> => {
  const partitions = new Set<string>();
  let continuationToken: string | undefined;

  do {
    const response = await s3Client.send(new ListObjectsV2Command({
      Bucket: bucket,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));

    for (const object of response.Contents || []) {
      const key = object.Key || '';
      const match = key.match(partitionPattern);
      if (!match) {
        continue;
      }

      const [, year, month, day, hour] = match;
      partitions.add(partitionKey({ year, month, day, hour }));
    }

    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  return partitions;
};

const writeJson = async (bucket: string, key: string, body: unknown): Promise<void> => {
  await s3Client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: JSON.stringify(body),
    ContentType: 'application/json',
  }));
};

const parsePartition = (partition: string): Partition => {
  const [year, month, day, hour] = partition.split('-');

  return { year, month, day, hour };
};

export const handler = async (event: PlannerInput = {}): Promise<PlannerOutput> => {
  const bucket = event.bucket || DEFAULT_BUCKET;
  const prefix = event.prefix ?? DEFAULT_PREFIX;
  const outputPrefix = event.outputPrefix || DEFAULT_OUTPUT_PREFIX;
  const chunkSize = event.chunkSize || DEFAULT_CHUNK_SIZE;

  if (chunkSize <= 0) {
    throw new Error('chunkSize must be greater than zero');
  }

  const partitionSet = await listPartitionKeys(bucket, prefix);
  const partitions = Array.from(partitionSet)
    .map(parsePartition)
    .sort((a, b) => partitionSortKey(a) - partitionSortKey(b));

  const partitionChunks = chunk(partitions, chunkSize);
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const runPrefix = `${outputPrefix.replace(/\/$/, '')}/runs/${runId}`;

  const chunkKeys: string[] = [];

  for (let index = 0; index < partitionChunks.length; index += 1) {
    const chunkKey = `${runPrefix}/chunks/chunk-${String(index).padStart(5, '0')}.json`;
    await writeJson(bucket, chunkKey, partitionChunks[index]);
    chunkKeys.push(chunkKey);
  }

  const manifestKey = `${runPrefix}/manifest.json`;
  await writeJson(bucket, manifestKey, {
    bucket,
    outputPrefix,
    runId,
    chunkSize,
    totalPartitions: partitions.length,
    totalChunks: partitionChunks.length,
    chunkKeys,
  });

  return {
    bucket,
    outputPrefix,
    manifestKey,
    totalPartitions: partitions.length,
    totalChunks: partitionChunks.length,
    chunkKeys,
    ...(event.maxConcurrency !== undefined ? { maxConcurrency: event.maxConcurrency } : {}),
  };
};
