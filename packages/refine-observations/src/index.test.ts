import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler } from './index';

const mockEvent = {} as APIGatewayProxyEvent;

describe('handler', () => {
  let subject: APIGatewayProxyResult;

  beforeEach(async () => {
    subject = await handler(mockEvent);
  });

  it('should return a status code', () => {
    expect(subject.statusCode).toBe(200);
  });

  it('should return a body', () => {
    expect(subject.body).toEqual(JSON.stringify({
      message: 'Observations refined',
      refinedCount: 0,
    }));
  });
});
