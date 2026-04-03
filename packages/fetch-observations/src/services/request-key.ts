import { createHash } from 'crypto';
import { ValidatedQueryStringParams } from './query-string-param-validator';
import { AggregationLevel } from './series-query-resolution';

export const buildRequestKey = ({
  userKey,
  parameters,
  aggregationLevel,
}: {
  userKey: string;
  parameters: Required<Pick<ValidatedQueryStringParams, 'from' | 'to' | 'fields'>>;
  aggregationLevel: AggregationLevel;
}): string => {
  const input = JSON.stringify({
    userKey,
    from: parameters.from.toISOString(),
    to: parameters.to.toISOString(),
    fields: [...parameters.fields].sort(),
    aggregationLevel,
  });

  return createHash('sha256').update(input).digest('hex');
};
