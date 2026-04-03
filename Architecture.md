# Architecture

This document describes the repository structure and the runtime architecture of the weather application.

## Repository structure

```mermaid
flowchart TD
  A[weather monorepo]
  A --> B[packages/store-observations]
  A --> C[packages/fetch-observations]
  A --> D[packages/refine-observations]
  A --> E[packages/backfill-observations]
  A --> F[packages/weather-dashboard]
  A --> G[packages/cloud-computing]
  A --> H[infra]
  A --> I[.github/workflows]
```

## Package responsibilities

- `store-observations`
  Pulls Tempest observations and writes raw partitioned JSON into S3.
- `fetch-observations`
  Exposes Athena-backed query endpoints, including the dashboard-oriented `/series` endpoint.
- `refine-observations`
  Builds coarser Parquet rollups for long-range analytics.
- `backfill-observations`
  Rebuilds missing historical partitions.
- `weather-dashboard`
  Private authenticated web app for weather trends.
- `cloud-computing`
  Shared AWS adapters and utilities.
- `infra`
  Shared infrastructure stacks, including GitHub deploy-role policies.
- `.github/workflows`
  Tag-driven and manual deployment pipelines.

## Data flow

```mermaid
flowchart LR
  A[Tempest API] --> B[store-observations Lambda]
  B --> C[S3 raw observations]
  C --> D[Glue table: observations]
  D --> E[refine-observations Lambda]
  E --> F[S3 Parquet 15m rollups]
  E --> G[S3 Parquet daily rollups]
  F --> H[Glue table: observations_refined_15m]
  G --> I[Glue table: observations_refined_daily]
```

## Query architecture

The system now supports both high-detail inspection and long-range trend analysis without changing the dashboard request shape.

### Query paths

- `/observations`
  Raw Athena queries over the `observations` table.
- `/refined`
  Direct Athena queries over `observations_refined_15m`.
- `/series`
  Trend-oriented endpoint that chooses the most appropriate resolution automatically.

### Resolution selection

`/series` currently routes requests like this:

- up to `7d` -> `15m`
- over `7d` up to `18 months` -> `daily`
- over `18 months` -> `monthly`

`monthly` results are derived at query time from `observations_refined_daily`.

## Long-range query flow

```mermaid
sequenceDiagram
  participant UI as weather-dashboard
  participant API as fetch-observations /series
  participant REG as DynamoDB query registry
  participant ATH as Athena
  participant REF as refined tables

  UI->>API: GET /series?from=...&to=...&fields=...
  API->>API: Normalize request and choose resolution
  API->>REG: Check requestKey
  alt Reusable running query exists
    REG-->>API: RUNNING record
    API-->>UI: 202 + pollUrl
  else Reusable succeeded query exists
    REG-->>API: SUCCEEDED record
    API->>ATH: Read stored query results
    API-->>UI: 200 data
  else No reusable query
    API->>ATH: Start Athena query
    API->>REG: Put RUNNING record
    alt Athena completes within 5s
      API->>REG: Update SUCCEEDED
      API-->>UI: 200 data
    else Athena still running
      API-->>UI: 202 + pollUrl
    end
  end
  UI->>API: Poll every 1s for up to 60s
```

## Why the query registry exists

Long-range Athena queries can outlive a single HTTP request. The query registry exists so the same user can:

- refresh the page
- resubmit the same range query
- resume polling a still-running query

without starting duplicate Athena executions.

The registry is stored in DynamoDB because it needs:

- atomic conditional create
- consistent point reads
- cheap TTL-based cleanup

## Dashboard architecture

```mermaid
flowchart LR
  A[React dashboard] --> B[runtime-config.json]
  A --> C[Cognito auth]
  A --> D[API Gateway JWT route]
  D --> E[fetch-observations]
  E --> F[Athena]
  E --> G[DynamoDB query registry]
```

The dashboard remains thin. It:

- authenticates through Cognito
- requests chart data from `/series`
- displays loading, pending, success, and failure states
- shows the returned `aggregationLevel` so users can see the current level of detail

## Deployment architecture

- Packages are deployed independently with package-scoped tags.
- Shared deploy permissions are managed through the `github-tempest-cfn-deploy-role` infrastructure stack.
- The dashboard deploy depends on the role-policy stack being up to date before application deployment starts.

## Design constraints

- Keep cost low by preferring Athena plus pre-aggregated Parquet over always-on databases.
- Keep handlers thin and business logic in `services`.
- Preserve idempotency in scheduled data-processing jobs.
- Prefer package-local documentation for package behavior and this document for cross-package architecture.
