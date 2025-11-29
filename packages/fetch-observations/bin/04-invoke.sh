#!/bin/bash

source $(dirname "$0")/helpers/env-variables.sh
has_env_vars_set "TEMPEST_STACK_NAME_FETCH"

source "$(dirname "$0")"/helpers/is-logged-in-aws.sh
is_logged_in_aws

set -eo pipefail
FUNCTION=$(aws cloudformation describe-stack-resource --stack-name $TEMPEST_STACK_NAME_FETCH --logical-resource-id TempestLambdaFunction --query 'StackResourceDetail.PhysicalResourceId' --output text)

aws lambda invoke --function-name "$FUNCTION" out.json
cat out.json
echo "DONE"
