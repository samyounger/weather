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

## Deployment

Deployments are managed with AWS SAM config (`samconfig.toml`) in each deployable package.
Artifact buckets are fixed via `s3_bucket` in `samconfig.toml`, and GitHub Actions applies an S3 lifecycle policy to expire old deployment artifacts automatically.

### AWS Authentication
Make sure you have the AWS CLI installed and configured with appropriate credentials.
`$ aws configure`

If you are using [AWS SSO](https://aws.amazon.com/blogs/security/how-to-configure-the-aws-cli-to-use-aws-single-sign-on/), run the following command before deploying:
`$ aws sso login`

### Deploy store package
`$ npm run deploy --workspace=@weather/store-observations`

### Destroy store infrastructure
`$ npm run deploy:cleanup --workspace=@weather/store-observations`

### Deploy fetch package
`$ npm run deploy --workspace=@weather/fetch-observations`

### Destroy fetch infrastructure
`$ npm run deploy:cleanup --workspace=@weather/fetch-observations`

## Environment variables

The following environment variables are required for the source code, as provided in a .env file at root of the project. The application uses the [dotenv](https://github.com/motdotla/dotenv) module to make these variables available in the source code, example `process.env.NODE_ENV`.

```sh
TEMPEST_HOST="swd.weatherflow.com"
TEMPEST_TOKEN="some-token"
TEMPEST_DEVICE_ID="123"
TEMPEST_STATION_ID="321"
```

Infrastructure settings such as stack name, region, and artifact bucket are defined in each package's `samconfig.toml`.
