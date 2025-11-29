#!/bin/bash

source "$(dirname "$0")"/helpers/env-variables.sh
has_env_vars_set "TEMPEST_S3_BUCKET_FETCH"

source "$(dirname "$0")"/helpers/is-logged-in-aws.sh
is_logged_in_aws

set -eo pipefail
BUCKET_ID=$(dd if=/dev/random bs=8 count=1 2>/dev/null | od -An -tx1 | tr -d ' \t\n')
BUCKET_NAME="${TEMPEST_S3_BUCKET_FETCH}${BUCKET_ID}"
echo "$BUCKET_NAME" > bucket-name.txt
aws s3 mb s3://"$BUCKET_NAME"
