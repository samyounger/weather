import dotEnv from 'dotenv';
import { Database } from '@weather/cloud-computing';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { QueryStringParams, QueryStringParamValidator } from './services/query-string-param-validator';
import { QueryRegistry } from './services/query-registry';
import { handleAsyncQuery } from './services/async-query-handler';
import { handleSeriesQuery } from './services/series-query-handler';
import { handleSyncQuery } from './services/sync-query-handler';
import { getQueryTargetFromPath } from './services/query-target';

dotEnv.config({ path: '../../.env' });

const queryTargetError = 'Unsupported endpoint. Use /observations, /refined, or /series';

export const handler = async (event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> => {
  const endpointPath = (event as APIGatewayProxyEvent & { rawPath?: string }).rawPath ?? event.path;
  const queryTarget = getQueryTargetFromPath(endpointPath);
  const parameters = event.queryStringParameters as QueryStringParams;
  console.info('fetch-observations invocation started', {
    service: 'fetch-observations',
    endpointPath,
    queryTarget: queryTarget?.tableName,
    parameters,
  });

  try {
    if (!queryTarget) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: queryTargetError }),
      };
    }

    const queryStringParamValidator = new QueryStringParamValidator(parameters, queryTarget);
    if (!queryStringParamValidator.valid()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: queryStringParamValidator.returnError() }),
      };
    }

    const validatedParameters = queryStringParamValidator.validated();
    if (!validatedParameters) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Unable to parse query parameters' }),
      };
    }

    const databaseService = new Database();
    if (queryTarget.routeName === 'series') {
      return handleSeriesQuery(
        event,
        context,
        databaseService,
        new QueryRegistry(),
        validatedParameters,
      );
    }

    if (validatedParameters.mode === 'async') {
      return handleAsyncQuery(databaseService, validatedParameters, queryTarget);
    }

    return handleSyncQuery(event, context, databaseService, queryTarget, validatedParameters);
  } catch (error) {
    console.error('fetch-observations invocation failed', {
      service: 'fetch-observations',
      endpointPath,
      queryTarget: queryTarget?.tableName,
      parameters,
      error,
    });
    throw error;
  }
};
