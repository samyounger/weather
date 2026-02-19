import {
  AthenaClient,
  GetQueryExecutionCommand,
  GetQueryResultsCommand,
  QueryExecutionState,
  StartQueryExecutionCommand,
} from '@aws-sdk/client-athena';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

type WorkerInput = {
  bucket: string;
  chunkKey: string;
  database?: string;
  rawTable?: string;
  refinedTable?: string;
  refinedLocation?: string;
  outputLocation?: string;
  workGroup?: string;
};

type WorkerOutput = {
  bucket: string;
  chunkKey: string;
  attemptedDates: number;
  succeededDates: number;
  skippedDates: number;
  failedDates: number;
  insertedRows: number;
};

const REGION = process.env.AWS_REGION || 'eu-west-2';
const DEFAULT_DATABASE = process.env.BACKFILL_ATHENA_DATABASE || 'tempest_weather';
const DEFAULT_RAW_TABLE = process.env.BACKFILL_REFINED_RAW_TABLE || 'observations';
const DEFAULT_REFINED_TABLE = process.env.BACKFILL_REFINED_TABLE || 'observations_refined_15m';
const DEFAULT_REFINED_LOCATION = process.env.BACKFILL_REFINED_LOCATION || 's3://weather-tempest-records/refined/observations_refined_15m/';
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

const loadChunk = async (bucket: string, chunkKey: string): Promise<string[]> => {
  const response = await s3Client.send(new GetObjectCommand({ Bucket: bucket, Key: chunkKey }));
  if (!response.Body) {
    throw new Error(`Missing chunk payload for ${chunkKey}`);
  }

  const body = await streamToString(response.Body as NodeJS.ReadableStream);
  const parsed = JSON.parse(body) as string[];

  return parsed;
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

const executeQuery = async (
  query: string,
  database: string,
  outputLocation: string,
  workGroup: string,
): Promise<string> => {
  const response = await athenaClient.send(new StartQueryExecutionCommand({
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

  const queryExecutionId = response.QueryExecutionId;
  if (!queryExecutionId) {
    throw new Error('Failed to start Athena query');
  }

  const queryState = await waitForQuery(queryExecutionId);
  if (queryState !== QueryExecutionState.SUCCEEDED) {
    throw new Error(`Athena query ${queryExecutionId} failed with state: ${queryState}`);
  }

  return queryExecutionId;
};

const readFirstNumericCell = (results: { ResultSet?: { Rows?: Array<{ Data?: Array<{ VarCharValue?: string }> }> } }): number => {
  const rows = results.ResultSet?.Rows;
  if (!rows || rows.length < 2) {
    return 0;
  }

  const value = rows[1].Data?.[0]?.VarCharValue;
  if (!value) {
    return 0;
  }

  const numericValue = Number(value);
  return Number.isNaN(numericValue) ? 0 : numericValue;
};

const querySingleNumericResult = async (
  query: string,
  database: string,
  outputLocation: string,
  workGroup: string,
): Promise<number> => {
  const queryExecutionId = await executeQuery(query, database, outputLocation, workGroup);
  const results = await athenaClient.send(new GetQueryResultsCommand({ QueryExecutionId: queryExecutionId }));

  return readFirstNumericCell(results);
};

const createRefinedTableQuery = (refinedTable: string, refinedLocation: string): string => {
  return `
    CREATE EXTERNAL TABLE IF NOT EXISTS ${refinedTable} (
      period_start timestamp,
      winddirection_avg double,
      windavg_avg double,
      windgust_max double,
      pressure_avg double,
      airtemperature_avg double,
      relativehumidity_avg double,
      rainaccumulation_sum double,
      uv_avg double,
      solarradiation_avg double,
      sample_count bigint
    )
    PARTITIONED BY (
      year string,
      month string,
      day string,
      hour string
    )
    STORED AS PARQUET
    LOCATION '${refinedLocation}'
    TBLPROPERTIES (
      'parquet.compress'='SNAPPY'
    )`;
};

const existingRowsForDateQuery = (refinedTable: string, year: string, month: string, day: string): string => {
  return `
    SELECT CAST(COUNT(1) AS BIGINT) AS refined_rows
    FROM ${refinedTable}
    WHERE year='${year}'
    AND month='${month}'
    AND day='${day}'`;
};

const insertRefinedRowsForDateQuery = (
  rawTable: string,
  refinedTable: string,
  year: string,
  month: string,
  day: string,
): string => {
  return `
    INSERT INTO ${refinedTable}
    SELECT
      period_start,
      AVG(winddirection) AS winddirection_avg,
      AVG(windavg) AS windavg_avg,
      MAX(windgust) AS windgust_max,
      AVG(pressure) AS pressure_avg,
      AVG(airtemperature) AS airtemperature_avg,
      AVG(relativehumidity) AS relativehumidity_avg,
      SUM(rainaccumulation) AS rainaccumulation_sum,
      AVG(uv) AS uv_avg,
      AVG(solarradiation) AS solarradiation_avg,
      CAST(COUNT(1) AS BIGINT) AS sample_count,
      DATE_FORMAT(period_start, '%Y') AS year,
      DATE_FORMAT(period_start, '%m') AS month,
      DATE_FORMAT(period_start, '%d') AS day,
      DATE_FORMAT(period_start, '%H') AS hour
    FROM (
      SELECT
        DATE_TRUNC('hour', FROM_UNIXTIME(datetime))
          + INTERVAL '15' MINUTE * CAST(FLOOR(MINUTE(FROM_UNIXTIME(datetime)) / 15) AS INTEGER) AS period_start,
        winddirection,
        windavg,
        windgust,
        pressure,
        airtemperature,
        relativehumidity,
        rainaccumulation,
        uv,
        solarradiation
      FROM ${rawTable}
      WHERE year='${year}'
      AND month='${month}'
      AND day='${day}'
    ) source
    GROUP BY period_start`;
};

const parseDateParts = (date: string): { year: string; month: string; day: string } => {
  const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid date in chunk: ${date}`);
  }

  const [, year, month, day] = match;

  return { year, month, day };
};

export const handler = async (event: WorkerInput): Promise<WorkerOutput> => {
  const database = event.database || DEFAULT_DATABASE;
  const rawTable = event.rawTable || DEFAULT_RAW_TABLE;
  const refinedTable = event.refinedTable || DEFAULT_REFINED_TABLE;
  const refinedLocation = event.refinedLocation || DEFAULT_REFINED_LOCATION;
  const outputLocation = event.outputLocation || DEFAULT_OUTPUT_LOCATION;
  const workGroup = event.workGroup || DEFAULT_WORK_GROUP;

  const dates = await loadChunk(event.bucket, event.chunkKey);

  await executeQuery(createRefinedTableQuery(refinedTable, refinedLocation), database, outputLocation, workGroup);

  let succeededDates = 0;
  let skippedDates = 0;
  let insertedRows = 0;

  for (const date of dates) {
    const { year, month, day } = parseDateParts(date);

    const existingRows = await querySingleNumericResult(
      existingRowsForDateQuery(refinedTable, year, month, day),
      database,
      outputLocation,
      workGroup,
    );
    if (existingRows > 0) {
      skippedDates += 1;
      succeededDates += 1;
      continue;
    }

    await executeQuery(
      insertRefinedRowsForDateQuery(rawTable, refinedTable, year, month, day),
      database,
      outputLocation,
      workGroup,
    );

    const rowsAfterInsert = await querySingleNumericResult(
      existingRowsForDateQuery(refinedTable, year, month, day),
      database,
      outputLocation,
      workGroup,
    );

    insertedRows += rowsAfterInsert;
    succeededDates += 1;
  }

  return {
    bucket: event.bucket,
    chunkKey: event.chunkKey,
    attemptedDates: dates.length,
    succeededDates,
    skippedDates,
    failedDates: dates.length - succeededDates,
    insertedRows,
  };
};
