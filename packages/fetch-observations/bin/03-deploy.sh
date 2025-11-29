#!/bin/bash

source "$(dirname "$0")"/helpers/env-variables.sh
has_env_vars_set "TEMPEST_STACK_NAME_FETCH"

source "$(dirname "$0")"/helpers/is-logged-in-aws.sh
is_logged_in_aws

set -eo pipefail

function install_build_dependencies {
  npm install
  npm run build:prod
}

function deploy_application {
  ARTIFACT_BUCKET=$(cat bucket-name.txt)
  aws cloudformation package --template-file template.yaml --s3-bucket "$ARTIFACT_BUCKET" --output-template-file out.yml
  aws cloudformation deploy --template-file out.yml --stack-name "$TEMPEST_STACK_NAME_FETCH" --capabilities CAPABILITY_NAMED_IAM
}

function set_environment_variables {
  FUNCTION=$(aws cloudformation describe-stack-resource --stack-name "$TEMPEST_STACK_NAME_FETCH" --logical-resource-id TempestLambdaFunction --query 'StackResourceDetail.PhysicalResourceId' --output text)

  aws lambda update-function-configuration --function-name "$FUNCTION" --environment Variables="{
    NODE_ENV=production,
  }"
}

install_build_dependencies
deploy_application
set_environment_variables
