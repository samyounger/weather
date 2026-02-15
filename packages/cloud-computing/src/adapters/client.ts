import { AthenaClient } from "@aws-sdk/client-athena";
import { S3Client } from "@aws-sdk/client-s3";
import { fromSSO } from "@aws-sdk/credential-provider-sso";

const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

/*
  * Fetch the SSO credentials if not in production
  * @returns {Promise<undefined | Credentials>} The credentials to use for the client
 */
const resolveCredentials = async () => {
  // In Lambda, always use the execution role (never SSO/profile)
  if (isLambda || process.env.NODE_ENV === "production") {
    return undefined;
  }
  return await fromSSO({ profile: process.env.AWS_PROFILE })();
};

/*
  * Initialize the storage client
  * @param {string} region - The region to use for the client
  * @returns {Promise<S3Client>} The storage client
 */
export const storageClient = async (region: string): Promise<S3Client> => {
  const credentials = await resolveCredentials();

  return new S3Client({
    region,
    credentials,
  });
};

/*
  * Initialize the database client
  * @param {string} region - The region to use for the client
  * @returns {Promise<AthenaClient>} The database client
 */
export const databaseClient = async (region: string): Promise<AthenaClient> => {
  // In Lambda, always use the execution role (never SSO/profile)
  const credentials = isLambda || process.env.NODE_ENV === "production"
    ? undefined
    : await fromSSO({ profile: process.env.AWS_PROFILE })();

  return new AthenaClient({
    region,
    credentials,
  });
};
