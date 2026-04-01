# weather-dashboard Agent Draft

## Purpose

Private React + TypeScript PWA for viewing authenticated weather charts on a personal mobile device.

## Runtime Behavior

- Frontend build: Vite PWA static assets.
- Infrastructure: `template.yaml`
- Static hosting: S3 + CloudFront
- Auth: Cognito User Pool
- API access: API Gateway HTTP API with JWT authorization, invoking `fetch-observations`

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
