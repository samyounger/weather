import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

type PlannerInput = {
  bucket?: string;
  outputPrefix?: string;
  chunkSize?: number;
  maxConcurrency?: number;
  startDate?: string;
  endDate?: string;
  database?: string;
  rawTable?: string;
  refinedTable?: string;
  refinedLocation?: string;
  outputLocation?: string;
  workGroup?: string;
};

type PlannerOutput = {
  bucket: string;
  outputPrefix: string;
  manifestKey: string;
  totalDates: number;
  totalChunks: number;
  chunkKeys: string[];
  maxConcurrency?: number;
  startDate: string;
  endDate: string;
  database: string;
  rawTable: string;
  refinedTable: string;
  refinedLocation: string;
  outputLocation: string;
  workGroup: string;
};

const DEFAULT_BUCKET = process.env.BACKFILL_BUCKET || 'weather-tempest-records';
const DEFAULT_OUTPUT_PREFIX = process.env.BACKFILL_REFINED_OUTPUT_PREFIX || 'backfill/refined-15m';
const DEFAULT_CHUNK_SIZE = Number(process.env.BACKFILL_REFINED_CHUNK_SIZE || '30');
const DEFAULT_END_DATE_OFFSET_DAYS = Number(process.env.BACKFILL_REFINED_END_OFFSET_DAYS || '1');
const DEFAULT_DATABASE = process.env.BACKFILL_ATHENA_DATABASE || 'tempest_weather';
const DEFAULT_RAW_TABLE = process.env.BACKFILL_REFINED_RAW_TABLE || 'observations';
const DEFAULT_REFINED_TABLE = process.env.BACKFILL_REFINED_TABLE || 'observations_refined_15m';
const DEFAULT_REFINED_LOCATION = process.env.BACKFILL_REFINED_LOCATION || 's3://weather-tempest-records/refined/observations_refined_15m/';
const DEFAULT_OUTPUT_LOCATION = process.env.BACKFILL_ATHENA_OUTPUT || 's3://weather-tempest-records/queries/';
const DEFAULT_WORK_GROUP = process.env.BACKFILL_ATHENA_WORKGROUP || 'primary';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'eu-west-2' });

const chunk = <T>(items: T[], size: number): T[][] => {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
};

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

const parseIsoDate = (value: string, label: string): Date => {
  if (!isoDateRegex.test(value)) {
    throw new Error(`${label} must use YYYY-MM-DD format`);
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${label} is invalid`);
  }

  return date;
};

const toIsoDate = (value: Date): string => value.toISOString().slice(0, 10);

const defaultEndDateIso = (): string => {
  const now = new Date();
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - DEFAULT_END_DATE_OFFSET_DAYS));

  return toIsoDate(end);
};

const enumerateDatesInclusive = (startDate: string, endDate: string): string[] => {
  const start = parseIsoDate(startDate, 'startDate');
  const end = parseIsoDate(endDate, 'endDate');

  if (start > end) {
    throw new Error('startDate must be less than or equal to endDate');
  }

  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(toIsoDate(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dates;
};

const writeJson = async (bucket: string, key: string, body: unknown): Promise<void> => {
  await s3Client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: JSON.stringify(body),
    ContentType: 'application/json',
  }));
};

export const handler = async (event: PlannerInput = {}): Promise<PlannerOutput> => {
  const chunkSize = event.chunkSize ?? DEFAULT_CHUNK_SIZE;
  if (chunkSize <= 0) {
    throw new Error('chunkSize must be greater than zero');
  }

  const startDate = event.startDate || process.env.BACKFILL_REFINED_START_DATE;
  if (!startDate) {
    throw new Error('startDate is required (event.startDate or BACKFILL_REFINED_START_DATE)');
  }

  const endDate = event.endDate || process.env.BACKFILL_REFINED_END_DATE || defaultEndDateIso();

  const dates = enumerateDatesInclusive(startDate, endDate);
  const dateChunks = chunk(dates, chunkSize);

  const bucket = event.bucket || DEFAULT_BUCKET;
  const outputPrefix = event.outputPrefix || DEFAULT_OUTPUT_PREFIX;
  const database = event.database || DEFAULT_DATABASE;
  const rawTable = event.rawTable || DEFAULT_RAW_TABLE;
  const refinedTable = event.refinedTable || DEFAULT_REFINED_TABLE;
  const refinedLocation = event.refinedLocation || DEFAULT_REFINED_LOCATION;
  const outputLocation = event.outputLocation || DEFAULT_OUTPUT_LOCATION;
  const workGroup = event.workGroup || DEFAULT_WORK_GROUP;

  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const runPrefix = `${outputPrefix.replace(/\/$/, '')}/runs/${runId}`;

  const chunkKeys: string[] = [];
  for (let index = 0; index < dateChunks.length; index += 1) {
    const chunkKey = `${runPrefix}/chunks/chunk-${String(index).padStart(5, '0')}.json`;
    await writeJson(bucket, chunkKey, dateChunks[index]);
    chunkKeys.push(chunkKey);
  }

  const manifestKey = `${runPrefix}/manifest.json`;
  await writeJson(bucket, manifestKey, {
    bucket,
    outputPrefix,
    runId,
    chunkSize,
    startDate,
    endDate,
    totalDates: dates.length,
    totalChunks: dateChunks.length,
    chunkKeys,
  });

  return {
    bucket,
    outputPrefix,
    manifestKey,
    totalDates: dates.length,
    totalChunks: dateChunks.length,
    chunkKeys,
    ...(event.maxConcurrency !== undefined ? { maxConcurrency: event.maxConcurrency } : {}),
    startDate,
    endDate,
    database,
    rawTable,
    refinedTable,
    refinedLocation,
    outputLocation,
    workGroup,
  };
};
