#!/bin/bash
set -eo pipefail

source $(dirname "$0")/helpers/env-variables.sh
has_env_vars_set "TEMPEST_STACK_NAME_FETCH"

source "$(dirname "$0")"/helpers/is-logged-in-aws.sh
is_logged_in_aws

# Find and delete stacks in ROLLBACK_COMPLETE state
ROLLBACK_STACKS=$(aws cloudformation list-stacks --stack-status-filter ROLLBACK_COMPLETE --query 'StackSummaries[].StackName' --output text)
for STACK in $ROLLBACK_STACKS; do
    echo "Deleting stack in ROLLBACK_COMPLETE: $STACK"
    aws cloudformation delete-stack --stack-name "$STACK"
done


echo "Deleting stack $TEMPEST_STACK_NAME_FETCH"

FUNCTION=$(aws cloudformation describe-stack-resource --stack-name "$TEMPEST_STACK_NAME_FETCH" --logical-resource-id TempestLambdaFunction --query 'StackResourceDetail.PhysicalResourceId' --output text)
# shellcheck disable=SC2086
aws cloudformation delete-stack --stack-name $TEMPEST_STACK_NAME_FETCH
echo "Deleted $TEMPEST_STACK_NAME_FETCH stack."

if [ -f bucket-name.txt ]; then
    ARTIFACT_BUCKET=$(cat bucket-name.txt)
    if [[ ! $ARTIFACT_BUCKET =~ tempest-artifacts-fetch-[a-z0-9]{16} ]] ; then
        echo "Bucket was not created by this application. Skipping."
    else
        while true; do
            read -p "Delete deployment artifacts and bucket ($ARTIFACT_BUCKET)? (y/n)" response
            case $response in
                [Yy]* ) aws s3 rb --force s3://"$ARTIFACT_BUCKET"; rm bucket-name.txt; break;;
                [Nn]* ) break;;
                * ) echo "Response must start with y or n.";;
            esac
        done
    fi
fi

while true; do
    read -p "Delete function log group (/aws/lambda/$FUNCTION)? (y/n)" response
    case $response in
        [Yy]* ) aws logs delete-log-group --log-group-name /aws/lambda/"$FUNCTION"; break;;
        [Nn]* ) break;;
        * ) echo "Response must start with y or n.";;
    esac
done

rm -f out.yml out.json
rm -rf lib
