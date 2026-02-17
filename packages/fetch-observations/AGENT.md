# fetch-observations Agent Draft

## Purpose

API Lambda package that fetches weather observations by querying Athena over partitioned datasets in S3.

## Runtime Behavior

- Entrypoint: `src/index.ts`
- Validates query string parameters.
- Builds SQL query fragments based on requested filters and fields.
- Executes Athena queries through shared cloud-computing adapters.

## Infrastructure

- SAM template: `template.yaml`
- Stack/env config: `samconfig.toml`
- Deployed as a Lambda workload for read/query access patterns.

## Commands

- `npm run build --workspace=@weather/fetch-observations`
- `npm run test --workspace=@weather/fetch-observations`
- `npm run test:coverage --workspace=@weather/fetch-observations`
- `npm run deploy --workspace=@weather/fetch-observations`

## Notes for Changes

- Query parameter validation and SQL generation should stay tightly tested.
- Any schema changes in raw/refined tables should be reflected in query builders and tests.
