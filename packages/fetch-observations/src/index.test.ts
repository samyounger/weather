import { handler } from './index';
import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from "aws-lambda";

const mockDatabaseGetResults = jest.fn().mockReturnValue(new Promise((resolve) => {
  setTimeout(() => {
    resolve(JSON.parse('{"ResultSet": {"Rows": [{"Data": [{"VarCharValue": "2020-01-01T00:00:00Z"}]}]}}'));
  }, 100);
}));
jest.mock('@weather/cloud-computing', () => ({
  Database: jest.fn().mockImplementation(() => ({
    getResults: mockDatabaseGetResults,
  })),
}));

const mockQueryParamValidatorValid = jest.fn().mockReturnValue(true);
const mockQueryParamValidatorErrorMessage = jest.fn().mockReturnValue('Mock error message one');
const mockQueryParamValidatorValidated = jest.fn().mockReturnValue({
  from: new Date('2026-02-19T00:00:00Z'),
  to: new Date('2026-02-19T01:00:00Z'),
  fromEpochSeconds: 1771459200,
  toEpochSeconds: 1771462800,
  fields: ['datetime', 'winddirection'],
  limit: 100,
});
jest.mock('./services/query-string-param-validator', () => ({
  QueryStringParamValidator: jest.fn().mockImplementation(() => ({
    valid: mockQueryParamValidatorValid,
    returnError: mockQueryParamValidatorErrorMessage,
    validated: mockQueryParamValidatorValidated,
  })),
}));

const mockQueryPreparationValid = jest.fn().mockReturnValue(true);
const mockQueryPreparationResponseText = jest.fn().mockReturnValue('Mock error message two');
const mockQueryPreparationId = jest.fn().mockReturnValue({ QueryExecutionId: '123' });
jest.mock('./services/query-preparation', () => ({
  QueryPreparation: jest.fn().mockImplementation(() => ({
    queryResponse: mockQueryPreparationId(),
    valid: mockQueryPreparationValid,
    responseText: mockQueryPreparationResponseText,
  }))
}));

const mockEvent: APIGatewayProxyEvent = {
  queryStringParameters: {
    from: '2026-02-19T00:00:00Z',
    to: '2026-02-19T01:00:00Z',
    fields: 'datetime,winddirection',
    limit: '100',
  },
} as unknown as APIGatewayProxyEvent;

describe('handler', () => {
  let subject: APIGatewayProxyResult;
  const mockContext: Context = {
    getRemainingTimeInMillis: () => 60000,
  } as Context;

  const callHandler = async () => {
    const query = handler(mockEvent, mockContext);
    subject = await query;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('when query params are invalid', () => {
    beforeEach(async () => {
      mockQueryParamValidatorValid.mockReturnValue(false);
      await callHandler();
    });

    it('should return 400', () => {
      expect(subject.statusCode).toBe(400);
    });

    it('should return an error message', () => {
      expect(subject.body).toEqual(JSON.stringify({
        error: 'Mock error message one',
      }));
    });
  });

  describe('when query params are valid', () => {
    beforeEach(() => {
      mockQueryParamValidatorValid.mockReturnValue(true);
      mockQueryParamValidatorValidated.mockReturnValue({
        from: new Date('2026-02-19T00:00:00Z'),
        to: new Date('2026-02-19T01:00:00Z'),
        fromEpochSeconds: 1771459200,
        toEpochSeconds: 1771462800,
        fields: ['datetime', 'winddirection'],
        limit: 100,
      });
    });

    describe('when parsed query params are unavailable', () => {
      beforeEach(async () => {
        mockQueryParamValidatorValidated.mockReturnValue(undefined);
        await callHandler();
      });

      it('should return 400', () => {
        expect(subject.statusCode).toBe(400);
      });

      it('should return an error message', () => {
        expect(subject.body).toEqual(JSON.stringify({
          error: 'Unable to parse query parameters',
        }));
      });
    });

    describe('when query preparation fails', () => {
      beforeEach(async () => {
        mockQueryPreparationValid.mockReturnValue(false);
        await callHandler();
      });

      it('should return 500', () => {
        expect(subject.statusCode).toBe(500);
      });

      it('should return an error message', () => {
        expect(subject.body).toEqual(JSON.stringify({
          error: 'Mock error message two',
        }));
      });
    });

    describe('when the query preparation succeeds', () => {
      beforeEach(() => {
        mockQueryPreparationValid.mockReturnValue(true);
      });

      describe('when query result fetching fails', () => {
        beforeEach(async () => {
          mockDatabaseGetResults.mockResolvedValue([]);
          await callHandler();
        });

        it('should return 500', () => {
          expect(subject.statusCode).toBe(500);
        });

        it('should return an error message', () => {
          expect(subject.body).toEqual(JSON.stringify({
            error: 'Failed to retrieve Athena query results',
          }));
        });
      });

      describe('when query result fetching succeeds', () => {
        beforeEach(async () => {
          mockDatabaseGetResults.mockReturnValue(new Promise((resolve) => {
            setTimeout(() => {
              resolve(JSON.parse('{"ResultSet": {"Rows": [{"Data": [{"VarCharValue": "2020-01-01T00:00:00Z"}]}]}}'));
            }, 100);
          }));
          await callHandler();
        });

        it('should return 200', () => {
          expect(subject.statusCode).toBe(200);
        });

        it('should return the response body', () => {
          expect(subject.body).toEqual(JSON.stringify({
            parameters: {
              ...mockEvent.queryStringParameters,
            },
            data: [['2020-01-01T00:00:00Z']],
          }));
        });
      });
    });
  });
});
