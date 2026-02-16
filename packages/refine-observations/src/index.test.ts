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
  inserted: 96,
  existingRows: 0,
});

(RefinementService as unknown as jest.Mock).mockImplementation(() => ({
  refineForYesterday: mockRefineForYesterday,
}));

describe('handler', () => {
  let subject: APIGatewayProxyResult;

  beforeEach(() => {
    mockRefineForYesterday.mockResolvedValue({
      date: '2026-02-14',
      inserted: 96,
      existingRows: 0,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const invokeHandler = async (): Promise<void> => {
    subject = await handler(mockEvent);
  };

  it('should return a status code', () => {
    return invokeHandler().then(() => {
      expect(subject.statusCode).toBe(200);
    });
  });

  it('should return a success body when new refinement is inserted', async () => {
    await invokeHandler();

    expect(subject.body).toEqual(JSON.stringify({
      message: 'Observations refined successfully',
      date: '2026-02-14',
      inserted: 96,
      existingRows: 0,
    }));
  });

  it('should return an already-refined message when no insert is needed', async () => {
    mockRefineForYesterday.mockResolvedValueOnce({
      date: '2026-02-14',
      inserted: 0,
      existingRows: 96,
    });

    await invokeHandler();

    expect(subject.statusCode).toBe(200);
    expect(subject.body).toEqual(JSON.stringify({
      message: 'Observations were already refined for target date',
      date: '2026-02-14',
      inserted: 0,
      existingRows: 96,
    }));
  });
});
