import { ValidatedQueryStringParams } from './query-string-param-validator';

export type AggregationLevel = '15m' | 'daily' | 'monthly';

export type ResolvedSeriesQuery = {
  aggregationLevel: AggregationLevel;
  tableName: 'observations_refined_15m' | 'observations_refined_daily';
};

const DAY_MS = 24 * 60 * 60 * 1000;
const EIGHTEEN_MONTHS_MS = 548 * DAY_MS;

export const resolveSeriesQuery = (
  parameters: Required<Pick<ValidatedQueryStringParams, 'from' | 'to' | 'resolution'>>,
): ResolvedSeriesQuery => {
  if (parameters.resolution === '15m') {
    return {
      aggregationLevel: '15m',
      tableName: 'observations_refined_15m',
    };
  }

  if (parameters.resolution === 'daily') {
    return {
      aggregationLevel: 'daily',
      tableName: 'observations_refined_daily',
    };
  }

  if (parameters.resolution === 'monthly') {
    return {
      aggregationLevel: 'monthly',
      tableName: 'observations_refined_daily',
    };
  }

  const rangeMs = parameters.to.getTime() - parameters.from.getTime();
  if (rangeMs <= 7 * DAY_MS) {
    return {
      aggregationLevel: '15m',
      tableName: 'observations_refined_15m',
    };
  }

  if (rangeMs <= EIGHTEEN_MONTHS_MS) {
    return {
      aggregationLevel: 'daily',
      tableName: 'observations_refined_daily',
    };
  }

  return {
    aggregationLevel: 'monthly',
    tableName: 'observations_refined_daily',
  };
};
