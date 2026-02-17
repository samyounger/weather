import dotEnv from 'dotenv';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Database } from '@weather/cloud-computing';
import { RefinementService } from './services/refinement-service';

dotEnv.config({ path:'../../.env' });

export const handler = async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  console.info('refine-observations invocation started', {
    service: 'refine-observations',
  });
  try {
    const refinementService = new RefinementService(new Database());
    const refinementSummary = await refinementService.refineForYesterday();

    console.info('refine-observations invocation completed', {
      service: 'refine-observations',
      refinementSummary,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: refinementSummary.inserted > 0
          ? 'Observations refined successfully'
          : 'Observations were already refined for target date',
        date: refinementSummary.date,
        inserted: refinementSummary.inserted,
        existingRows: refinementSummary.existingRows,
      }),
    };
  } catch (error) {
    console.error('refine-observations invocation failed', {
      service: 'refine-observations',
      error,
    });
    throw error;
  }
};
