# backfill-observations Agent Draft

## Purpose

One-off backfill workflow for historical Athena partition registration.
Used to discover partition keys from existing S3 data and register them in controlled chunks.

## Runtime Behavior

- State machine defined in `template.yaml`.
- Planner Lambda scans S3 and writes manifest/chunk files.
- Map state processes chunk keys with worker Lambda.
- Worker submits batched Athena `ALTER TABLE ... ADD IF NOT EXISTS PARTITION ...` statements.
- Summarize Lambda reports chunk success/failure totals and failed chunk keys for reruns.

## Inputs and Defaults

Typical execution input includes:

- `bucket`
- `prefix`
- `outputPrefix`
- `chunkSize`
- `maxConcurrency`
- optional Athena settings (`database`, `table`, `outputLocation`, `workGroup`)

Planner applies defaults for omitted values.

## Infrastructure

- SAM template: `template.yaml`
- Package README with execution examples: `README.md`
- Stack/env config: `samconfig.toml`

## Commands

- `npm run build --workspace=@weather/backfill-observations`
- `npm run test --workspace=@weather/backfill-observations`
- `npm run test:coverage --workspace=@weather/backfill-observations`
- `npm run deploy --workspace=@weather/backfill-observations`

## Notes for Changes

- Be careful with Step Functions JSONPath usage when task outputs replace state input.
- Preserve execution-input compatibility for failed-chunk reruns.
