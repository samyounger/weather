# cloud-computing Agent Draft

## Purpose

Shared library package for AWS integrations used by other workspace packages.
Primary responsibilities are Athena query execution, S3 storage helpers, and partition date utilities.

## Main Exports

- Database adapter for Athena queries and partition registration.
- Storage adapter for S3 interactions.
- Partition date utility helpers.

See `src/index.ts` for the export surface.

## Typical Usage

Consumed by:

- `@weather/store-observations`
- `@weather/fetch-observations`
- `@weather/refine-observations`

## Commands

Run from repo root or package directory:

- `npm run build --workspace=@weather/cloud-computing`
- `npm run test --workspace=@weather/cloud-computing`
- `npm run test:coverage --workspace=@weather/cloud-computing`

## Notes for Changes

- Keep APIs stable where possible because this package is shared across multiple lambdas.
- Prefer adding tests for adapter behavior and error handling whenever changing AWS interactions.
