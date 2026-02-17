# Weather Monorepo Agent Draft

## What This Repository Does

This repository runs a weather data pipeline built around AWS Lambda, Athena, and S3.
It ingests Tempest weather observations, stores raw partitioned data, exposes query APIs, and builds refined datasets for analytics.

## High-Level Flow

1. `store-observations` fetches Tempest readings and writes raw JSON to S3 (`year/month/day/hour` partitions).
2. `fetch-observations` serves Athena-backed query responses over stored observations.
3. `refine-observations` runs scheduled Athena refinement jobs to create lower-granularity analytical tables.
4. `backfill-observations` is a one-off Step Functions workflow for historical partition backfill in Athena.
5. `cloud-computing` provides shared adapters/utilities for AWS services used by other packages.

## Workspace Packages

- `packages/cloud-computing`: shared AWS clients and database/storage helpers.
- `packages/store-observations`: scheduled Lambda ingestion of Tempest observations.
- `packages/fetch-observations`: API Lambda for querying weather observations.
- `packages/refine-observations`: scheduled Lambda to build refined Athena outputs.
- `packages/backfill-observations`: Step Functions + Lambdas to backfill missing Athena partitions.

## Common Commands

From repo root:

- `npm run build`
- `npm run test`
- `npm run test:coverage`
- `npm run lint`
- `npm run deploy`

Per-package deploy commands are defined in each package `package.json` and `samconfig.toml`.

## Workflow

Use this workflow for all code changes in this repository:

1. Make the change.
2. Add or update unit tests for the change.
3. Run lint from repo root: `npm run lint`.
4. Run coverage tests from repo root: `npm run test:coverage`.
5. Only commit when lint passes and coverage is acceptable.

Coverage standard:

- Minimum total coverage target is `90%`.
- New or changed code should be unit-tested.
- Aim for `100%` statement coverage where practical.

Code organization standard:

- Place larger business logic in `services` modules when the logic no longer fits cleanly in a small function.
- Place smaller reusable logic in utility helper functions (`utils`).
- Keep handlers and entrypoints thin; delegate business behavior to `services`/`utils`.

## AWS and Deployment Notes

- Deployable packages use AWS SAM templates (`template.yaml`) and environment config (`samconfig.toml`).
- Artifact buckets are package-specific and configured in each package `samconfig.toml`.
- Region in current package configs is `eu-west-2`.
- AWS credentials or AWS SSO login are required before deployment.

## Draft Intent

This document is a draft orientation file for future automation agents.
Package-level `AGENT.md` files contain package-specific details and should be treated as the source of truth for local package behavior.
