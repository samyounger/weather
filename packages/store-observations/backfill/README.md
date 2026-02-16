# Athena Partition Backfill

This folder contains a one-off backfill workflow that discovers historical S3 partitions and registers them in Athena.

## Files

- `planner.ts`: scans S3 object keys, extracts `year/month/day/hour` partitions, writes chunk files + manifest.
- `worker.ts`: reads one chunk, executes batched `ALTER TABLE ... ADD IF NOT EXISTS PARTITION ...` in Athena.
- `template.yaml`: SAM template for planner/worker Lambdas and a Step Functions state machine.

## Prerequisites

- Existing raw data in `s3://weather-tempest-records/` with partitioned paths:
  - `year=YYYY/month=MM/day=DD/hour=HH/*.json`
- Athena table already defined as partitioned by `year, month, day, hour`.
- IAM permissions for S3 + Athena + Glue from the SAM template.

## Build and deploy

Run from this directory:

```bash
sam build -t template.yaml
sam deploy --guided
```

## Start execution

Example execution input:

```json
{
  "bucket": "weather-tempest-records",
  "prefix": "",
  "outputPrefix": "backfill/athena-partitions",
  "chunkSize": 100,
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

## Notes

- Backfill is idempotent via `ADD IF NOT EXISTS`.
- Tune `chunkSize` and `MaxConcurrency` if Athena throttles.
- Safe rerun strategy: rerun with the same source prefix and table.
