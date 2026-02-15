import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { handler } from './index';
import { RefinementService } from './services/refinement-service';

jest.mock('@weather/cloud-computing', () => ({
  Database: jest.fn(),
}));
jest.mock('./services/refinement-service');

const mockEvent = {} as APIGatewayProxyEvent;
const mockRefineForYesterday = jest.fn().mockResolvedValue({
  date: '2026-02-14',
  inserted: true,
  existingRows: 0,
});

(RefinementService as unknown as jest.Mock).mockImplementation(() => ({
  refineForYesterday: mockRefineForYesterday,
}));

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
      message: 'Observations refined successfully',
      date: '2026-02-14',
      inserted: true,
      existingRows: 0,
    }));
  });
});
