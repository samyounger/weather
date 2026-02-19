import { QueryStringParams, QueryStringParamValidator } from "./query-string-param-validator";

const queryStringParams: QueryStringParams = {
  from: '2026-02-19T00:00:00Z',
  to: '2026-02-19T01:00:00Z',
  fields: 'winddirection,airtemperature',
  limit: '50',
};

describe('QueryStringParamValidator', () => {
  describe('#valid', () => {
    it('returns true for a valid sync query', () => {
      const service = new QueryStringParamValidator(queryStringParams);

      expect(service.valid()).toBe(true);
      expect(service.validated()).toEqual({
        mode: 'sync',
        queryExecutionId: undefined,
        nextToken: undefined,
        from: new Date('2026-02-19T00:00:00Z'),
        to: new Date('2026-02-19T01:00:00Z'),
        fromEpochSeconds: 1771459200,
        toEpochSeconds: 1771462800,
        fields: ['winddirection', 'airtemperature'],
        limit: 50,
      });
    });

    it('returns true for async poll requests with queryExecutionId only', () => {
      const service = new QueryStringParamValidator({ mode: 'ASYNC', queryExecutionId: 'query-123', nextToken: 'abc' });

      expect(service.valid()).toBe(true);
      expect(service.validated()).toEqual({
        mode: 'async',
        queryExecutionId: 'query-123',
        nextToken: 'abc',
      });
    });

    it('returns true for async poll requests without nextToken', () => {
      const service = new QueryStringParamValidator({ mode: 'async', queryExecutionId: 'query-123' });

      expect(service.valid()).toBe(true);
      expect(service.validated()).toEqual({
        mode: 'async',
        queryExecutionId: 'query-123',
        nextToken: undefined,
      });
    });

    it('returns false when mode is invalid', () => {
      const service = new QueryStringParamValidator({ mode: 'batch' });

      expect(service.valid()).toBe(false);
      expect(service.returnError()).toBe('mode must be sync or async');
    });

    it('returns false when required query parameters are missing', () => {
      const service = new QueryStringParamValidator({ to: '2026-02-19T01:00:00Z' });

      expect(service.valid()).toBe(false);
      expect(service.returnError()).toBe('Missing required query parameters: from');
    });

    it('returns false when dates are invalid', () => {
      const service = new QueryStringParamValidator({ from: 'bad', to: '2026-02-19T01:00:00Z' });

      expect(service.valid()).toBe(false);
      expect(service.returnError()).toBe('from and to must be valid ISO-8601 date-time strings');
    });

    it('returns false when from is not earlier than to', () => {
      const service = new QueryStringParamValidator({ from: '2026-02-19T01:00:00Z', to: '2026-02-19T01:00:00Z' });

      expect(service.valid()).toBe(false);
      expect(service.returnError()).toBe('from must be earlier than to');
    });

    it('returns false when range exceeds 7 days', () => {
      const service = new QueryStringParamValidator({ from: '2026-02-01T00:00:00Z', to: '2026-02-09T00:00:01Z' });

      expect(service.valid()).toBe(false);
      expect(service.returnError()).toBe('Date range cannot exceed 7 days');
    });

    it('returns false when limit exceeds max', () => {
      const service = new QueryStringParamValidator({ from: '2026-02-19T00:00:00Z', to: '2026-02-19T01:00:00Z', limit: '1001' });

      expect(service.valid()).toBe(false);
      expect(service.returnError()).toBe('limit cannot exceed 1000');
    });

    it('returns false when limit is not a positive integer', () => {
      const service = new QueryStringParamValidator({ from: '2026-02-19T00:00:00Z', to: '2026-02-19T01:00:00Z', limit: 'abc' });

      expect(service.valid()).toBe(false);
      expect(service.returnError()).toBe('limit must be a positive integer');
    });

    it('returns false when fields include unsupported columns', () => {
      const service = new QueryStringParamValidator({ from: '2026-02-19T00:00:00Z', to: '2026-02-19T01:00:00Z', fields: 'winddirection,badfield' });

      expect(service.valid()).toBe(false);
      expect(service.returnError()).toBe('Unsupported fields requested: badfield');
    });

    it('applies defaults when optional params are omitted', () => {
      const service = new QueryStringParamValidator({ from: '2026-02-19T00:00:00Z', to: '2026-02-19T01:00:00Z' });

      expect(service.valid()).toBe(true);
      expect(service.validated()).toMatchObject({
        mode: 'sync',
        limit: 100,
        fields: ['datetime', 'winddirection', 'windavg', 'windgust', 'airtemperature', 'relativehumidity', 'rainaccumulation'],
      });
    });

    it('falls back to default fields when fields are blank', () => {
      const service = new QueryStringParamValidator({ from: '2026-02-19T00:00:00Z', to: '2026-02-19T01:00:00Z', fields: ' , ' });

      expect(service.valid()).toBe(true);
      expect(service.validated()).toMatchObject({
        fields: [],
      });
    });
  });

  describe('#returnError', () => {
    it('returns default missing message before validation', () => {
      const service = new QueryStringParamValidator(null);

      expect(service.returnError()).toBe('Missing required query parameters');
    });

    it('returns missing parameter message when no params are present', () => {
      const service = new QueryStringParamValidator(null);

      expect(service.valid()).toBe(false);
      expect(service.returnError()).toBe('Missing required query parameters');
    });
  });
});
