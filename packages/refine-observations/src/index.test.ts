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
  fifteenMinuteInserted: 96,
  fifteenMinuteExistingRows: 0,
  dailyInserted: 1,
  dailyExistingRows: 0,
});

(RefinementService as unknown as jest.Mock).mockImplementation(() => ({
  refineForYesterday: mockRefineForYesterday,
}));

describe('handler', () => {
  let subject: APIGatewayProxyResult;

  beforeEach(() => {
    mockRefineForYesterday.mockResolvedValue({
      date: '2026-02-14',
      fifteenMinuteInserted: 96,
      fifteenMinuteExistingRows: 0,
      dailyInserted: 1,
      dailyExistingRows: 0,
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
      fifteenMinuteInserted: 96,
      fifteenMinuteExistingRows: 0,
      dailyInserted: 1,
      dailyExistingRows: 0,
    }));
  });

  it('should return an already-refined message when no insert is needed', async () => {
    mockRefineForYesterday.mockResolvedValueOnce({
      date: '2026-02-14',
      fifteenMinuteInserted: 0,
      fifteenMinuteExistingRows: 96,
      dailyInserted: 0,
      dailyExistingRows: 1,
    });

    await invokeHandler();

    expect(subject.statusCode).toBe(200);
    expect(subject.body).toEqual(JSON.stringify({
      message: 'Observations were already refined for target date',
      date: '2026-02-14',
      fifteenMinuteInserted: 0,
      fifteenMinuteExistingRows: 96,
      dailyInserted: 0,
      dailyExistingRows: 1,
    }));
  });
});
