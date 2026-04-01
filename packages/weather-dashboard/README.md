# Weather Dashboard Package

Private PWA dashboard for viewing authenticated weather charts from the existing weather backend.

## Architecture

- React + TypeScript + Vite
- Feature-Sliced Design frontend structure
- Cognito password auth
- API Gateway HTTP API with JWT authorizer
- S3 + CloudFront static hosting

## Runtime config

The deployed app reads `/runtime-config.json` at runtime. Deployment writes environment-specific values for:

- `apiBaseUrl`
- `cognitoRegion`
- `cognitoUserPoolId`
- `cognitoClientId`
- `mockMode` optional boolean for local UI-only runs

## Commands

```sh
npm run build --workspace=@weather/weather-dashboard
npm run test --workspace=@weather/weather-dashboard
npm run test:coverage --workspace=@weather/weather-dashboard
npm run deploy --workspace=@weather/weather-dashboard
```

## Local mock mode

`public/runtime-config.json` is configured for local mock mode in this repo so `npm run start:dev --workspace=@weather/weather-dashboard` can run without AWS, Cognito, or the weather API.

When `mockMode` is `true`:

- any email/password can sign in locally
- sign-up and confirmation stay in-app without calling Cognito
- chart requests return deterministic sample weather data for the selected dataset and fields
