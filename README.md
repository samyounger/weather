# Weather

A weather application that queries the tempest wx weather API.

## Installation instructions

```sh
$ npm install
```

## Start the application

```sh
$ npm run start
```

## Deployments

Deployments are tag-driven.

### How it works
1. A PR is merged to `main`.
2. `.github/workflows/tag-packages-on-merge.yml` checks changed files and dependency impact per package.
3. For each affected package, the workflow creates a package-scoped semver tag:
   - `pkg/store-observations/vX.Y.Z`
   - `pkg/fetch-observations/vX.Y.Z`
   - `pkg/refine-observations/vX.Y.Z`
   - `pkg/backfill-observations/vX.Y.Z`
   - `pkg/cloud-computing/vX.Y.Z`
   - `pkg/github-tempest-cfn-deploy-role/vX.Y.Z` (IAM deploy-role policy stack)
4. Tag push triggers `.github/workflows/deploy-from-package-tag.yml`.
5. The tag deploy workflow:
   - creates a GitHub Deployment record per environment
   - runs the package deployment via reusable workflows
   - updates deployment status to `success` or `failure`
   - writes a run summary to `$GITHUB_STEP_SUMMARY`

### Reusable deployment workflows
- `.github/workflows/reusable-deploy-sam-observations.yml`
- `.github/workflows/reusable-deploy-sam-backfill.yml`
- `.github/workflows/reusable-deploy-cloud-computing.yml`
- `.github/workflows/reusable-deploy-role-policy.yml`

### Required GitHub repository variables
- `AWS_IAM_DEPLOY_ROLE_ARN`
- `AWS_IAM_BOOTSTRAP_DEPLOY_ROLE_ARN`
- `ALERT_EMAIL`
- `TEMPEST_HOST`
- `TEMPEST_DEVICE_ID`
- `TEMPEST_STATION_ID`

### Required GitHub repository secrets
- `TEMPEST_TOKEN`

### Local/manual AWS SAM deploy (optional)
Deployments in CI are tag-driven, but local deploy is still available.

`$ npm run deploy --workspace=@weather/store-observations`
`$ npm run deploy --workspace=@weather/fetch-observations`
`$ npm run deploy --workspace=@weather/refine-observations`
`$ npm run deploy --workspace=@weather/backfill-observations`

Infrastructure settings such as stack name, region, and artifact bucket are defined in each package's `samconfig.toml`.

## Refine Observations Logic

`refine-observations` is a scheduled Lambda that transforms high-frequency raw observations into lower-frequency analytical data for Athena.

### Why this exists
- Raw observations are written as many small JSON objects under partitioned S3 paths.
- Athena queries over longer date ranges become slow and expensive when scanning the raw dataset.
- Refinement reduces row volume and stores query-friendly parquet data.

### What it does
1. Runs daily (UTC schedule) and targets the previous UTC day.
2. Ensures a refined Athena table exists: `observations_refined_15m`.
3. Checks whether refined rows already exist for that day and skips processing if they do (idempotent behavior).
4. If not refined yet, aggregates raw `observations` into 15-minute buckets:
   - average values (for example temperature/humidity/wind averages)
   - max wind gust
   - summed rainfall
   - sample count
5. Writes refined parquet output to:
   - `s3://weather-tempest-records/refined/observations_refined_15m/`
   - partitioned by `year/month/day/hour`

### Query strategy
- Use raw `observations` for short, high-detail windows.
- Use `observations_refined_15m` for broader date ranges to significantly reduce Athena scan size and latency.

An example query to get daily average temperature for January 2024:

```sql
SELECT
  date_trunc('day', timestamp) AS day,
  AVG(temperature) AS avg_temp
FROM
  "weather-tempest-records"."observations_refined_15m"
WHERE
  timestamp >= TIMESTAMP '2024-01-01 00:00:00'
  AND timestamp < TIMESTAMP '2024-02-01 00:00:00'
GROUP BY
  date_trunc('day', timestamp)
ORDER BY
  day;
```

An example query to get raw observations for January 1, 2024:

```sql
SELECT datetime FROM observations
WHERE year='2026'
  AND month>='01' AND month<='03'
  AND day>='01' AND day<='02'
  AND hour>='01' AND hour<='02'
ORDER BY datetime DESC LIMIT 500;
```

## Environment variables

The following environment variables are required for the source code, as provided in a .env file at root of the project. The application uses the [dotenv](https://github.com/motdotla/dotenv) module to make these variables available in the source code, example `process.env.NODE_ENV`.

```sh
TEMPEST_HOST="swd.weatherflow.com"
TEMPEST_TOKEN="some-token"
TEMPEST_DEVICE_ID="123"
TEMPEST_STATION_ID="321"
```

Infrastructure settings such as stack name, region, and artifact bucket are defined in each package's `samconfig.toml`.
