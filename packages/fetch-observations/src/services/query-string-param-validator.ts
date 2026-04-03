import { APIGatewayProxyEventQueryStringParameters } from "aws-lambda/trigger/api-gateway-proxy";
import { QueryTarget } from "./query-target";

export interface QueryStringParams extends APIGatewayProxyEventQueryStringParameters {
  from?: string;
  to?: string;
  fields?: string;
  limit?: string;
  nextToken?: string;
  mode?: string;
  queryExecutionId?: string;
  requestKey?: string;
  resolution?: string;
}

export interface ValidatedQueryStringParams {
  mode: 'sync' | 'async';
  queryExecutionId?: string;
  requestKey?: string;
  nextToken?: string;
  from?: Date;
  to?: Date;
  fromEpochSeconds?: number;
  toEpochSeconds?: number;
  fields?: string[];
  limit?: number;
  resolution?: 'auto' | '15m' | 'daily' | 'monthly';
}

const MAX_LIMIT = 1000;
const DEFAULT_LIMIT = 100;

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
    private queryTarget: QueryTarget,
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
    const requestKey = this.queryStringParams?.requestKey;

    if (mode === 'async' && (queryExecutionId || requestKey)) {
      this.validatedParams = {
        mode,
        queryExecutionId,
        requestKey,
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

    if (this.queryTarget.maxRangeMs && (to.getTime() - from.getTime()) > this.queryTarget.maxRangeMs) {
      this.errorText = `Date range cannot exceed ${Math.round(this.queryTarget.maxRangeMs / (24 * 60 * 60 * 1000))} days`;
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

    const resolution = this.parseResolution();
    if (!resolution) {
      return false;
    }

    this.validatedParams = {
      mode,
      queryExecutionId,
      requestKey,
      nextToken: this.queryStringParams?.nextToken,
      from,
      to,
      fromEpochSeconds: Math.floor(from.getTime() / 1000),
      toEpochSeconds: Math.floor(to.getTime() / 1000),
      fields,
      limit,
      resolution,
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
      : this.queryTarget.defaultFields;

    const invalidFields = fields.filter((field) => !this.queryTarget.allowedFields.has(field));
    if (invalidFields.length > 0) {
      this.errorText = `Unsupported fields requested: ${invalidFields.join(', ')}`;
      return undefined;
    }

    return [...new Set(fields)];
  }

  private parseResolution(): 'auto' | '15m' | 'daily' | 'monthly' | undefined {
    const resolution = (this.queryStringParams?.resolution ?? 'auto').toLowerCase();
    if (resolution !== 'auto' && resolution !== '15m' && resolution !== 'daily' && resolution !== 'monthly') {
      this.errorText = 'resolution must be auto, 15m, daily, or monthly';
      return undefined;
    }

    return resolution;
  }
}
