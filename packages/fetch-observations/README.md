# Fetch Observations Package

Query weather observations from Athena using a bounded date/time range.

## Endpoints

- `/observations` (also `/`) queries the raw `observations` table.
- `/refined` queries the `observations_refined_15m` table.

## API Query Modes

### 1. Sync mode (default)
Runs the Athena query and returns data in one request.

Required query params:
- `from` (ISO-8601 datetime)
- `to` (ISO-8601 datetime)

Optional query params:
- `fields` (comma-separated column list)
- `limit` (max rows, default `100`, max `1000`)
- `nextToken` (Athena pagination token)

Example:
```bash
curl "https://<function-url>/observations?from=2026-02-19T00:00:00Z&to=2026-02-19T01:00:00Z&fields=datetime,winddirection,airtemperature&limit=200"
```

### 2. Async mode
Use async mode for longer-running queries.

Start query:
- `mode=async`
- `from`
- `to`
- optional `fields`, `limit`

```bash
curl "https://<function-url>/observations?mode=async&from=2026-02-19T00:00:00Z&to=2026-02-19T06:00:00Z&fields=datetime,windavg,windgust"
```

Response includes `queryExecutionId` with HTTP `202`.

Poll query:
- `mode=async`
- `queryExecutionId`
- optional `nextToken`

```bash
curl "https://<function-url>/observations?mode=async&queryExecutionId=<QUERY_ID>"
```

Possible async poll responses:
- `202` when still running/queued
- `200` with data when succeeded
- `500` when failed/cancelled

## Pagination
Both sync and async result fetches support pagination via `nextToken`.

- Read `nextToken` from the response.
- Pass it back in the next request to continue reading rows.

## Field Selection
`fields` must be a comma-separated subset of allowed columns for the endpoint you call (`/observations` or `/refined`).

If unsupported fields are provided, request returns `400`.

### Available Fields

- `deviceid`
- `datetime`
- `windlull`
- `windavg`
- `windgust`
- `winddirection`
- `windsampleinterval`
- `pressure`
- `airtemperature`
- `relativehumidity`
- `illuminance`
- `uv`
- `solarradiation`
- `rainaccumulation`
- `precipitationtype`
- `avgstrikedistance`
- `strikecount`
- `battery`
- `reportinterval`
- `localdayrainaccumulation`
- `ncrainaccumulation`
- `localdayncrainaccumulation`
- `precipitationanalysis`
- `year`
- `month`
- `day`
- `hour`

### Refined Endpoint Fields (`/refined`)

- `period_start`
- `winddirection_avg`
- `windavg_avg`
- `windgust_max`
- `pressure_avg`
- `airtemperature_avg`
- `relativehumidity_avg`
- `rainaccumulation_sum`
- `uv_avg`
- `solarradiation_avg`
- `sample_count`
- `year`
- `month`
- `day`
- `hour`

## Validation and Limits

- `from` and `to` must be valid ISO-8601 date-time strings.
- `from` must be earlier than `to`.
- Maximum range is `7 days`.
- `limit` must be a positive integer.
- Maximum `limit` is `1000`.

## Safety Controls

- Athena queries run with a dedicated workgroup (`ATHENA_WORKGROUP`) to enforce guardrails.
- Query polling uses an application timeout (`QUERY_TIMEOUT_MS`, default `25000`).
- If Lambda is close to timeout, query polling triggers cancellation using a safety buffer (`QUERY_TIMEOUT_SAFETY_BUFFER_MS`, default `5000`).
- Cancelled queries return a timeout/cancel response instead of hanging until Lambda hard timeout.

## Limitations

- Max query window is 7 days; larger windows must be split client-side.
- Response row count per page is bounded by Athena pagination and the configured `limit`.
- Async mode requires client-managed polling and retry behavior.
- If Athena query execution fails/cancels, API returns a server error response.
- This package exposes both raw (`observations`) and refined (`observations_refined_15m`) query endpoints.
