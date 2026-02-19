import { APIGatewayProxyEventQueryStringParameters } from "aws-lambda/trigger/api-gateway-proxy";

export interface QueryStringParams extends APIGatewayProxyEventQueryStringParameters {
  from?: string;
  to?: string;
  fields?: string;
  limit?: string;
  nextToken?: string;
  mode?: string;
  queryExecutionId?: string;
}

export interface ValidatedQueryStringParams {
  mode: 'sync' | 'async';
  queryExecutionId?: string;
  nextToken?: string;
  from?: Date;
  to?: Date;
  fromEpochSeconds?: number;
  toEpochSeconds?: number;
  fields?: string[];
  limit?: number;
}

const DEFAULT_FIELDS = ['datetime', 'winddirection', 'windavg', 'windgust', 'airtemperature', 'relativehumidity', 'rainaccumulation'];
const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 100;
const MAX_RANGE_MS = 7 * 24 * 60 * 60 * 1000;
const ALLOWED_FIELDS = new Set([
  'deviceid',
  'datetime',
  'windlull',
  'windavg',
  'windgust',
  'winddirection',
  'windsampleinterval',
  'pressure',
  'airtemperature',
  'relativehumidity',
  'illuminance',
  'uv',
  'solarradiation',
  'rainaccumulation',
  'precipitationtype',
  'avgstrikedistance',
  'strikecount',
  'battery',
  'reportinterval',
  'localdayrainaccumulation',
  'ncrainaccumulation',
  'localdayncrainaccumulation',
  'precipitationanalysis',
  'year',
  'month',
  'day',
  'hour',
]);

const parseIsoDate = (input: string): Date | null => {
  const timestamp = Date.parse(input);
  if (Number.isNaN(timestamp)) {
    return null;
  }

  return new Date(timestamp);
};

const parsePositiveInteger = (value: string | undefined, fallback: number): number | null => {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

export class QueryStringParamValidator {
  private errorText = '';

  private validatedParams?: ValidatedQueryStringParams;

  public constructor(
    private queryStringParams: Partial<QueryStringParams> | null,
  ) {}

  public valid(): boolean {
    this.errorText = '';
    this.validatedParams = undefined;

    if (!this.queryParamsExist()) {
      this.errorText = 'Missing required query parameters';
      return false;
    }

    const mode = this.parseMode();
    if (!mode) {
      return false;
    }

    const queryExecutionId = this.queryStringParams?.queryExecutionId;

    if (mode === 'async' && queryExecutionId) {
      this.validatedParams = {
        mode,
        queryExecutionId,
        nextToken: this.queryStringParams?.nextToken,
      };

      return true;
    }

    const missingParams = this.missingDateRangeParams();
    if (missingParams.length > 0) {
      this.errorText = `Missing required query parameters: ${missingParams.join(', ')}`;
      return false;
    }

    const from = parseIsoDate(this.queryStringParams?.from as string);
    const to = parseIsoDate(this.queryStringParams?.to as string);
    if (!from || !to) {
      this.errorText = 'from and to must be valid ISO-8601 date-time strings';
      return false;
    }

    if (from >= to) {
      this.errorText = 'from must be earlier than to';
      return false;
    }

    if ((to.getTime() - from.getTime()) > MAX_RANGE_MS) {
      this.errorText = 'Date range cannot exceed 7 days';
      return false;
    }

    const limit = parsePositiveInteger(this.queryStringParams?.limit, DEFAULT_LIMIT);
    if (!limit) {
      this.errorText = 'limit must be a positive integer';
      return false;
    }

    if (limit > MAX_LIMIT) {
      this.errorText = `limit cannot exceed ${MAX_LIMIT}`;
      return false;
    }

    const fields = this.parseFields();
    if (!fields) {
      return false;
    }

    this.validatedParams = {
      mode,
      queryExecutionId,
      nextToken: this.queryStringParams?.nextToken,
      from,
      to,
      fromEpochSeconds: Math.floor(from.getTime() / 1000),
      toEpochSeconds: Math.floor(to.getTime() / 1000),
      fields,
      limit,
    };

    return true;
  }

  public returnError(): string {
    if (!this.queryParamsExist() && !this.errorText) {
      return 'Missing required query parameters';
    }

    return this.errorText;
  }

  public validated(): ValidatedQueryStringParams | undefined {
    return this.validatedParams;
  }

  private queryParamsExist(): boolean {
    return !!this.queryStringParams;
  }

  private parseMode(): 'sync' | 'async' | undefined {
    const mode = (this.queryStringParams?.mode ?? 'sync').toLowerCase();
    if (mode !== 'sync' && mode !== 'async') {
      this.errorText = 'mode must be sync or async';
      return undefined;
    }

    return mode;
  }

  private missingDateRangeParams(): string[] {
    return ['from', 'to']
      .filter((param) => this.queryStringParams && this.queryStringParams[param] === undefined);
  }

  private parseFields(): string[] | undefined {
    const fields = this.queryStringParams?.fields
      ? this.queryStringParams.fields.split(',').map((field) => field.trim().toLowerCase()).filter(Boolean)
      : DEFAULT_FIELDS;

    const invalidFields = fields.filter((field) => !ALLOWED_FIELDS.has(field));
    if (invalidFields.length > 0) {
      this.errorText = `Unsupported fields requested: ${invalidFields.join(', ')}`;
      return undefined;
    }

    return [...new Set(fields)];
  }
}
