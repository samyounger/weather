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
    const insertedRows = refinementSummary.fifteenMinuteInserted + refinementSummary.dailyInserted;
    const existingRows = refinementSummary.fifteenMinuteExistingRows + refinementSummary.dailyExistingRows;
    const message = insertedRows > 0
      ? 'Observations refined successfully'
      : existingRows > 0
        ? 'Observations were already refined for target date'
        : 'No raw observations were available for the target date';

    console.info('refine-observations invocation completed', {
      service: 'refine-observations',
      refinementSummary,
      message,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message,
        date: refinementSummary.date,
        fifteenMinuteInserted: refinementSummary.fifteenMinuteInserted,
        fifteenMinuteExistingRows: refinementSummary.fifteenMinuteExistingRows,
        dailyInserted: refinementSummary.dailyInserted,
        dailyExistingRows: refinementSummary.dailyExistingRows,
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
