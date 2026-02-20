import { ValidatedQueryStringParams } from "../services/query-string-param-validator";
import { QueryTarget } from "../services/query-target";

type SyncValidatedQueryStringParams = Required<Pick<
  ValidatedQueryStringParams,
  'from' | 'to' | 'fromEpochSeconds' | 'toEpochSeconds' | 'fields' | 'limit'
>>;

export class ObservationQueries {
  public static getObservationsByDateRange({
    fields,
    from,
    to,
    fromEpochSeconds,
    toEpochSeconds,
    limit,
  }: SyncValidatedQueryStringParams): string {
    return this.getByDateRange({
      tableName: 'observations',
      timestampColumn: 'datetime',
      fields,
      from,
      to,
      fromEpochSeconds,
      toEpochSeconds,
      limit,
    });
  }

  public static getRefinedByDateRange({
    fields,
    from,
    to,
    fromEpochSeconds,
    toEpochSeconds,
    limit,
  }: SyncValidatedQueryStringParams): string {
    return this.getByDateRange({
      tableName: 'observations_refined_15m',
      timestampColumn: 'period_start',
      fields,
      from,
      to,
      fromEpochSeconds,
      toEpochSeconds,
      limit,
    });
  }

  public static getByDateRange({
    tableName,
    timestampColumn,
    fields,
    from,
    to,
    fromEpochSeconds,
    toEpochSeconds,
    limit,
  }: SyncValidatedQueryStringParams & Pick<QueryTarget, 'tableName' | 'timestampColumn'>): string {
    const rangePredicate = timestampColumn === 'period_start'
      ? `${timestampColumn} >= FROM_UNIXTIME(${fromEpochSeconds})\n      AND ${timestampColumn} <= FROM_UNIXTIME(${toEpochSeconds})`
      : `${timestampColumn} >= ${fromEpochSeconds}\n      AND ${timestampColumn} <= ${toEpochSeconds}`;

    return `
      SELECT ${fields.join(',')} FROM ${tableName}
      WHERE ${rangePredicate}
      AND (${this.buildPartitionPredicate(from, to)})
      ORDER BY ${timestampColumn} ASC LIMIT ${limit};`;
  }

  private static buildPartitionPredicate(from: Date, to: Date): string {
    const partitionPredicates: string[] = [];
    const current = new Date(from.getTime());

    current.setUTCMinutes(0, 0, 0);

    while (current <= to) {
      const year = String(current.getUTCFullYear());
      const month = String(current.getUTCMonth() + 1).padStart(2, '0');
      const day = String(current.getUTCDate()).padStart(2, '0');
      const hour = String(current.getUTCHours()).padStart(2, '0');

      partitionPredicates.push(`(year='${year}' AND month='${month}' AND day='${day}' AND hour='${hour}')`);
      current.setUTCHours(current.getUTCHours() + 1);
    }

    return partitionPredicates.join(' OR ');
  }
}
