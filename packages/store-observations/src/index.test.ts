import { handler } from './index';
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { RESPONSE_DURATION } from "./services/__mocks__/device-observations-service";

jest.useFakeTimers();

jest.mock('@weather/cloud-computing');
jest.mock('./services/device-observations-service');
jest.mock('./services/observations-service');

const mockEvent: APIGatewayProxyEvent = {} as APIGatewayProxyEvent;

describe('handler', () => {
  let subject: APIGatewayProxyResult;

  beforeEach(async () => {
    const query = handler(mockEvent);
    jest.advanceTimersByTime(RESPONSE_DURATION);
    subject = await query;
  });

  it('should return a status code', () => {
    expect(subject.statusCode).toBe(200);
  });

  it('should return a body', () => {
    expect(subject.body).toEqual(JSON.stringify({
      readings: 2,
      insertCount: 2,
      partitionStatus: { succeeded: 2, failed: 0 },
    }));
  });
});
