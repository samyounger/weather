# store-observations Agent Draft

## Purpose

Scheduled Lambda that reads current Tempest observations and stores raw observation files in S3.
After writing records, it attempts to add corresponding Athena partitions for each observed hour.

## Runtime Behavior

- Entrypoint: `src/index.ts`
- Core flow: `src/services/device-observations-service.ts`
- Writes raw JSON files to partitioned S3 paths.
- Calls shared `Database.addObservationsPartition(...)` to keep Athena partition metadata current.

## Infrastructure

- SAM template: `template.yaml`
- Scheduled by EventBridge rule in `template.yaml`.
- Stack/env config: `samconfig.toml`

## Commands

- `npm run build --workspace=@weather/store-observations`
- `npm run test --workspace=@weather/store-observations`
- `npm run test:coverage --workspace=@weather/store-observations`
- `npm run deploy --workspace=@weather/store-observations`

## Operational Check

Successful runs should show partition updates in Lambda logs (`partitionStatus.failed` should be `0` for healthy runs) and corresponding partitions visible in Athena.
