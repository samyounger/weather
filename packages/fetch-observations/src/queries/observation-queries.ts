import { ValidatedQueryStringParams } from "../services/query-string-param-validator";
import { QueryTarget } from "../services/query-target";

type SyncValidatedQueryStringParams = Required<Pick<
  ValidatedQueryStringParams,
  'from' | 'to' | 'fromEpochSeconds' | 'toEpochSeconds' | 'fields' | 'limit'
>>;

type PartitionGranularity = 'hour' | 'month';

const MONTHLY_FIELD_EXPRESSIONS: Record<string, string> = {
  period_start: "DATE_TRUNC('month', period_start) AS period_start",
  winddirection_avg: 'AVG(winddirection_avg) AS winddirection_avg',
  windavg_avg: 'AVG(windavg_avg) AS windavg_avg',
  windgust_max: 'MAX(windgust_max) AS windgust_max',
  pressure_avg: 'AVG(pressure_avg) AS pressure_avg',
  airtemperature_avg: 'AVG(airtemperature_avg) AS airtemperature_avg',
  relativehumidity_avg: 'AVG(relativehumidity_avg) AS relativehumidity_avg',
  rainaccumulation_sum: 'SUM(rainaccumulation_sum) AS rainaccumulation_sum',
  uv_avg: 'AVG(uv_avg) AS uv_avg',
  solarradiation_avg: 'AVG(solarradiation_avg) AS solarradiation_avg',
  sample_count: 'CAST(SUM(sample_count) AS BIGINT) AS sample_count',
};

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
      partitionGranularity: 'hour',
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
      partitionGranularity: 'hour',
      fields,
      from,
      to,
      fromEpochSeconds,
      toEpochSeconds,
      limit,
    });
  }

  public static getDailySeriesByDateRange({
    fields,
    from,
    to,
    fromEpochSeconds,
    toEpochSeconds,
    limit,
  }: SyncValidatedQueryStringParams): string {
    return this.getByDateRange({
      tableName: 'observations_refined_daily',
      timestampColumn: 'period_start',
      partitionGranularity: 'month',
      fields,
      from,
      to,
      fromEpochSeconds,
      toEpochSeconds,
      limit,
    });
  }

  public static getMonthlySeriesByDateRange({
    fields,
    fromEpochSeconds,
    toEpochSeconds,
    from,
    to,
    limit,
  }: SyncValidatedQueryStringParams): string {
    const selectedFields = fields.map((field) => MONTHLY_FIELD_EXPRESSIONS[field] ?? field);

    return `
      SELECT ${selectedFields.join(', ')}
      FROM observations_refined_daily
      WHERE period_start >= FROM_UNIXTIME(${fromEpochSeconds})
      AND period_start <= FROM_UNIXTIME(${toEpochSeconds})
      AND (${this.buildPartitionPredicate(from, to, 'month')})
      GROUP BY DATE_TRUNC('month', period_start)
      ORDER BY DATE_TRUNC('month', period_start) ASC
      LIMIT ${limit};`;
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
    partitionGranularity = 'hour',
  }: SyncValidatedQueryStringParams & Pick<QueryTarget, 'tableName' | 'timestampColumn'> & { partitionGranularity?: PartitionGranularity }): string {
    const rangePredicate = timestampColumn === 'period_start'
      ? `${timestampColumn} >= FROM_UNIXTIME(${fromEpochSeconds})\n      AND ${timestampColumn} <= FROM_UNIXTIME(${toEpochSeconds})`
      : `${timestampColumn} >= ${fromEpochSeconds}\n      AND ${timestampColumn} <= ${toEpochSeconds}`;

    return `
      SELECT ${fields.join(',')} FROM ${tableName}
      WHERE ${rangePredicate}
      AND (${this.buildPartitionPredicate(from, to, partitionGranularity)})
      ORDER BY ${timestampColumn} ASC LIMIT ${limit};`;
  }

  private static buildPartitionPredicate(from: Date, to: Date, granularity: PartitionGranularity): string {
    const partitionPredicates: string[] = [];
    const current = new Date(from.getTime());

    if (granularity === 'hour') {
      current.setUTCMinutes(0, 0, 0);
    } else {
      current.setUTCDate(1);
      current.setUTCHours(0, 0, 0, 0);
    }

    while (current <= to) {
      const year = String(current.getUTCFullYear());
      const month = String(current.getUTCMonth() + 1).padStart(2, '0');

      if (granularity === 'month') {
        partitionPredicates.push(`(year='${year}' AND month='${month}')`);
        current.setUTCMonth(current.getUTCMonth() + 1);
        continue;
      }

      const day = String(current.getUTCDate()).padStart(2, '0');
      const hour = String(current.getUTCHours()).padStart(2, '0');

      partitionPredicates.push(`(year='${year}' AND month='${month}' AND day='${day}' AND hour='${hour}')`);
      current.setUTCHours(current.getUTCHours() + 1);
    }

    return partitionPredicates.join(' OR ');
  }
}
