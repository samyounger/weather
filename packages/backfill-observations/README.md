# Athena Partition Backfill

This folder contains a one-off backfill workflow that discovers historical S3 partitions and registers them in Athena.


## Files

- `planner.ts`: scans S3 object keys, extracts `year/month/day/hour` partitions, writes chunk files + manifest.
- `worker.ts`: reads one chunk, executes batched `ALTER TABLE ... ADD IF NOT EXISTS PARTITION ...` in Athena.
- `summarize.ts`: summarizes chunk outcomes and returns `failedChunkKeys` for retry runs.
- `template.yaml`: SAM template for planner/worker/summarize Lambdas and a Step Functions state machine.

## Prerequisites

- Existing raw data in `s3://weather-tempest-records/` with partitioned paths:
  - `year=YYYY/month=MM/day=DD/hour=HH/*.json`
- Athena table already defined as partitioned by `year, month, day, hour`.
- IAM permissions for S3 + Athena + Glue from the SAM template.

## Build and deploy

Run from repo root:

```bash
npm run deploy --workspace=@weather/backfill-observations
```

## Start execution

Example execution input:

```json
{
  "bucket": "weather-tempest-records",
  "prefix": "",
  "outputPrefix": "backfill/athena-partitions",
  "chunkSize": 100,
  "maxConcurrency": 3,
  "database": "tempest_weather",
  "table": "observations",
  "outputLocation": "s3://weather-tempest-records/queries/",
  "workGroup": "primary"
}
```

Start the run:

```bash
aws stepfunctions start-execution \
  --state-machine-arn <BACKFILL_STATE_MACHINE_ARN> \
  --input file://input.json
```

## Monitoring

- Step Functions execution graph for per-chunk progress.
- CloudWatch logs for `BackfillPlannerFunction` and `BackfillWorkerFunction`.
- Planner writes:
  - `.../runs/<run-id>/manifest.json`
  - `.../runs/<run-id>/chunks/chunk-*.json`
- State machine output contains:
  - `totalChunks`
  - `succeededChunks`
  - `failedChunks`
  - `failedChunkKeys`

## Failed-only rerun

Use failed chunk keys from the previous execution output to rerun only failed chunks:

```json
{
  "bucket": "weather-tempest-records",
  "maxConcurrency": 3,
  "chunkKeys": [
    "backfill/athena-partitions/runs/2026-02-16T00-00-00-000Z/chunks/chunk-00012.json",
    "backfill/athena-partitions/runs/2026-02-16T00-00-00-000Z/chunks/chunk-00044.json"
  ],
  "database": "tempest_weather",
  "table": "observations",
  "outputLocation": "s3://weather-tempest-records/queries/",
  "workGroup": "primary"
}
```


## Notes

- Backfill is idempotent via `ADD IF NOT EXISTS`.
- If `chunkKeys` are provided in execution input, planner is skipped and only those chunks are processed.
- Tune `chunkSize` and `maxConcurrency` (execution input field, default `3`) if Athena throttles.
- Safe rerun strategy: rerun with `failedChunkKeys`.
