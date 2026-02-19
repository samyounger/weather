import { ValidatedQueryStringParams } from "../services/query-string-param-validator";

export class ObservationQueries {
  private static TABLE_NAME = 'observations';

  public static getObservationsByDateRange({
    fields,
    from,
    to,
    fromEpochSeconds,
    toEpochSeconds,
    limit,
  }: ValidatedQueryStringParams): string {
    return `
      SELECT ${fields.join(',')} FROM ${this.TABLE_NAME}
      WHERE datetime >= ${fromEpochSeconds}
      AND datetime <= ${toEpochSeconds}
      AND (${this.buildPartitionPredicate(from, to)})
      ORDER BY datetime ASC LIMIT ${limit};`;
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
