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

## Commands

```sh
npm run build --workspace=@weather/weather-dashboard
npm run test --workspace=@weather/weather-dashboard
npm run test:coverage --workspace=@weather/weather-dashboard
npm run deploy --workspace=@weather/weather-dashboard
```
