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

## Shell scripts

There are helper build scripts for the various stages of building, deploying, executing, and destroying the application.

### AWS Authentication
Make sure you have the AWS CLI installed and configured with appropriate credentials.
`$ aws configure`

If you are using [AWS SSO](https://aws.amazon.com/blogs/security/how-to-configure-the-aws-cli-to-use-aws-single-sign-on/), make sure to run the following command to authenticate before running the scripts:
`$ aws sso login`

### Create aws S3 bucket
`$ bin/01-create-bucket.sh`

### Build the package and dist files
`$ bin/02-build-layer.sh`

### Deploy the application using cloudformation
`$ bin/03-deploy.sh`

### Run the application
`$ bin/04-invoke.sh`

### Destroy the cloud infrastructure
`$ bin/05-cleanup.sh`

## Environment variables

The following environment variables are required for the source code, as provided in a .env file at root of the project. The application uses the [dotenv](https://github.com/motdotla/dotenv) module to make these variables available in the source code, example `process.env.NODE_ENV`.

```sh
TEMPEST_HOST="swd.weatherflow.com"
TEMPEST_TOKEN="some-token"
TEMPEST_DEVICE_ID="123"
TEMPEST_STATION_ID="321"
```

The shell scripts also depend on environment variables. I use zsh in my shell, and oh-my-zsh dotfiles. This has a [dotenv plugin](https://github.com/ohmyzsh/ohmyzsh/tree/master/plugins/dotenv) to make the `.env` variables accessible from the shell scripts. If this doesn't work, try one of [these options](https://gist.github.com/mihow/9c7f559807069a03e302605691f85572).

The shell scripts require these environment variables:

```sh
BUCKET_NAME="some-s3-bucket-name-to-nest-files-under"
TEMPEST_STACK_NAME_STORE="the-store-application-name"
TEMPEST_STACK_NAME_FETCH="the-fetch-application-name"
```
