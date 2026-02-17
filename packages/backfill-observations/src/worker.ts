import {
  AthenaClient,
  GetQueryExecutionCommand,
  QueryExecutionState,
  StartQueryExecutionCommand,
} from '@aws-sdk/client-athena';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

export type Partition = {
  year: string;
  month: string;
  day: string;
  hour: string;
};

type WorkerInput = {
  bucket: string;
  chunkKey: string;
  database?: string;
  table?: string;
  outputLocation?: string;
  workGroup?: string;
};

type WorkerOutput = {
  bucket: string;
  chunkKey: string;
  attempted: number;
  succeeded: number;
  failed: number;
  queryExecutionId: string;
  queryState: QueryExecutionState | undefined;
};

const REGION = process.env.AWS_REGION || 'eu-west-2';
const DEFAULT_DATABASE = process.env.BACKFILL_ATHENA_DATABASE || 'tempest_weather';
const DEFAULT_TABLE = process.env.BACKFILL_ATHENA_TABLE || 'observations';
const DEFAULT_OUTPUT_LOCATION = process.env.BACKFILL_ATHENA_OUTPUT || 's3://weather-tempest-records/queries/';
const DEFAULT_WORK_GROUP = process.env.BACKFILL_ATHENA_WORKGROUP || 'primary';
const POLL_DELAY_MS = Number(process.env.BACKFILL_POLL_DELAY_MS || '2000');
const MAX_POLLS = Number(process.env.BACKFILL_MAX_POLLS || '120');

const s3Client = new S3Client({ region: REGION });
const athenaClient = new AthenaClient({ region: REGION });

const streamToString = async (stream: NodeJS.ReadableStream): Promise<string> => {
  const chunks: Buffer[] = [];

  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString('utf-8');
};

const sleep = async (ms: number): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, ms));
};

const loadChunk = async (bucket: string, chunkKey: string): Promise<Partition[]> => {
  const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: chunkKey }));
  if (!response.Body) {
    throw new Error(`Missing chunk payload for ${chunkKey}`);
  }

  const body = await streamToString(response.Body as NodeJS.ReadableStream);
  const parsed = JSON.parse(body) as Partition[];

  return parsed;
};

const buildAddPartitionsQuery = (table: string, partitions: Partition[]): string => {
  const statement = partitions.map(({ year, month, day, hour }) => {
    const location = `s3://weather-tempest-records/year=${year}/month=${month}/day=${day}/hour=${hour}/`;

    return `PARTITION (year='${year}', month='${month}', day='${day}', hour='${hour}') LOCATION '${location}'`;
  }).join('\n');

  return `ALTER TABLE ${table} ADD IF NOT EXISTS\n${statement};`;
};

const waitForQuery = async (queryExecutionId: string): Promise<QueryExecutionState | undefined> => {
  for (let queryCount = 0; queryCount <= MAX_POLLS; queryCount += 1) {
    const response = await athenaClient.send(new GetQueryExecutionCommand({ QueryExecutionId: queryExecutionId }));
    const state = response.QueryExecution?.Status?.State;

    if (
      state === QueryExecutionState.SUCCEEDED ||
      state === QueryExecutionState.FAILED ||
      state === QueryExecutionState.CANCELLED
    ) {
      return state;
    }

    await sleep(POLL_DELAY_MS);
  }

  return undefined;
};

export const handler = async (event: WorkerInput): Promise<WorkerOutput> => {
  const database = event.database || DEFAULT_DATABASE;
  const table = event.table || DEFAULT_TABLE;
  const outputLocation = event.outputLocation || DEFAULT_OUTPUT_LOCATION;
  const workGroup = event.workGroup || DEFAULT_WORK_GROUP;

  const partitions = await loadChunk(event.bucket, event.chunkKey);
  const query = buildAddPartitionsQuery(table, partitions);

  const startResponse = await athenaClient.send(new StartQueryExecutionCommand({
    QueryString: query,
    QueryExecutionContext: {
      Database: database,
      Catalog: 'AwsDataCatalog',
    },
    ResultConfiguration: {
      OutputLocation: outputLocation,
      EncryptionConfiguration: {
        EncryptionOption: 'SSE_S3',
      },
      AclConfiguration: {
        S3AclOption: 'BUCKET_OWNER_FULL_CONTROL',
      },
    },
    WorkGroup: workGroup,
    ResultReuseConfiguration: {
      ResultReuseByAgeConfiguration: {
        Enabled: false,
      },
    },
  }));

  const queryExecutionId = startResponse.QueryExecutionId;
  if (!queryExecutionId) {
    throw new Error('Failed to start Athena query');
  }

  const queryState = await waitForQuery(queryExecutionId);
  const failed = queryState === QueryExecutionState.SUCCEEDED ? 0 : partitions.length;
  const succeeded = queryState === QueryExecutionState.SUCCEEDED ? partitions.length : 0;

  if (queryState !== QueryExecutionState.SUCCEEDED) {
    throw new Error(`Athena query ${queryExecutionId} failed with state: ${queryState}`);
  }

  return {
    bucket: event.bucket,
    chunkKey: event.chunkKey,
    attempted: partitions.length,
    succeeded,
    failed,
    queryExecutionId,
    queryState,
  };
};
