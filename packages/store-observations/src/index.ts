import dotEnv from 'dotenv';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Storage, Database } from '@weather/cloud-computing';
import { ObservationsService } from './services/observations-service';
import { DeviceObservationFactory } from './factories/device-observation-factory';
import { DeviceObservationsService } from './services/device-observations-service';

dotEnv.config({ path:'../../.env' });

const initializeServices = () => {
  const storage = new Storage();
  const deviceObservationFactory = new DeviceObservationFactory();
  const observationsService = new ObservationsService(storage, deviceObservationFactory);
  const database = new Database();
  const deviceObservationsService = new DeviceObservationsService(observationsService, database);

  return { deviceObservationsService };
};

export const handler = async (_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const { deviceObservationsService } = initializeServices();
  const { reading, insertResult, partitionStatus } = await deviceObservationsService.fetchAndInsertReading();

  return {
    statusCode: 200,
    body: JSON.stringify({
      readings: reading.observations.length,
      insertCount: insertResult.length,
      partitionStatus,
    }),
  };
};
