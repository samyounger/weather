# weather-dashboard Agent Draft

## Purpose

Private React + TypeScript PWA for viewing authenticated weather charts on a personal mobile device.

## Runtime Behavior

- Frontend build: Vite PWA static assets.
- Infrastructure: `template.yaml`
- Static hosting: S3 + CloudFront
- Auth: Cognito User Pool
- API access: API Gateway HTTP API with JWT authorization, invoking `fetch-observations`
- Chart data is loaded through `/series`, not by directly choosing raw/refined tables in the client.
- The UI handles immediate loading, async polling, and resumable error states for long-range queries.

## Runtime Flow

```mermaid
flowchart LR
  A[Dashboard UI] --> B[runtime-config.json]
  A --> C[Cognito session]
  A --> D[/series API request]
  D --> E[fetch-observations]
  E --> F[Athena + query registry]
```

## Architecture Rules

- Frontend code follows Feature-Sliced Design.
- Keep cross-slice imports behind each slice's public API.
- Keep app-wide infrastructure concerns in `app` and `shared`.

## Commands

- `npm run build --workspace=@weather/weather-dashboard`
- `npm run test --workspace=@weather/weather-dashboard`
- `npm run test:coverage --workspace=@weather/weather-dashboard`
- `npm run deploy --workspace=@weather/weather-dashboard`

## Notes for Changes

- Do not expose any backend Lambda publicly.
- The browser should only call the authenticated API Gateway routes.
- Keep the dashboard aligned with the existing `fetch-observations` query contract.
- Keep trend-query UX explicit when requests move into async polling.
