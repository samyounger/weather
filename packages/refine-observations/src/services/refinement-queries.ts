export class RefinementQueries {
  private static readonly RAW_TABLE = 'observations';
  private static readonly REFINED_15M_TABLE = 'observations_refined_15m';
  private static readonly REFINED_DAILY_TABLE = 'observations_refined_daily';
  private static readonly REFINED_15M_LOCATION = 's3://weather-tempest-records/refined/observations_refined_15m/';
  private static readonly REFINED_DAILY_LOCATION = 's3://weather-tempest-records/refined/observations_refined_daily/';

  public static createRefinedTable = (): string => {
    return `
      CREATE EXTERNAL TABLE IF NOT EXISTS ${this.REFINED_15M_TABLE} (
        period_start timestamp,
        winddirection_avg double,
        windavg_avg double,
        windgust_max double,
        pressure_avg double,
        airtemperature_avg double,
        relativehumidity_avg double,
        rainaccumulation_sum double,
        uv_avg double,
        solarradiation_avg double,
        sample_count bigint
      )
      PARTITIONED BY (
        year string,
        month string,
        day string,
        hour string
      )
      STORED AS PARQUET
      LOCATION '${this.REFINED_15M_LOCATION}'
      TBLPROPERTIES (
        'parquet.compress'='SNAPPY'
      )`;
  };

  public static createDailyRefinedTable = (): string => {
    return `
      CREATE EXTERNAL TABLE IF NOT EXISTS ${this.REFINED_DAILY_TABLE} (
        period_start timestamp,
        winddirection_avg double,
        windavg_avg double,
        windgust_max double,
        pressure_avg double,
        airtemperature_avg double,
        relativehumidity_avg double,
        rainaccumulation_sum double,
        uv_avg double,
        solarradiation_avg double,
        sample_count bigint
      )
      PARTITIONED BY (
        year string,
        month string
      )
      STORED AS PARQUET
      LOCATION '${this.REFINED_DAILY_LOCATION}'
      TBLPROPERTIES (
        'parquet.compress'='SNAPPY'
      )`;
  };

  public static existingRowsForDate = ({ year, month, day }: { year: string; month: string; day: string }): string => {
    return `
      SELECT CAST(COUNT(1) AS BIGINT) AS refined_rows
      FROM ${this.REFINED_15M_TABLE}
      WHERE year='${year}'
      AND month='${month}'
      AND day='${day}'`;
  };

  public static existingDailyRowsForDate = ({ year, month, day }: { year: string; month: string; day: string }): string => {
    return `
      SELECT CAST(COUNT(1) AS BIGINT) AS refined_rows
      FROM ${this.REFINED_DAILY_TABLE}
      WHERE year='${year}'
      AND month='${month}'
      AND DATE_FORMAT(period_start, '%d')='${day}'`;
  };

  public static insertRefinedRowsForDate = ({ year, month, day }: { year: string; month: string; day: string }): string => {
    return `
      INSERT INTO ${this.REFINED_15M_TABLE}
      SELECT
        period_start,
        AVG(winddirection) AS winddirection_avg,
        AVG(windavg) AS windavg_avg,
        MAX(windgust) AS windgust_max,
        AVG(pressure) AS pressure_avg,
        AVG(airtemperature) AS airtemperature_avg,
        AVG(relativehumidity) AS relativehumidity_avg,
        SUM(rainaccumulation) AS rainaccumulation_sum,
        AVG(uv) AS uv_avg,
        AVG(solarradiation) AS solarradiation_avg,
        CAST(COUNT(1) AS BIGINT) AS sample_count,
        DATE_FORMAT(period_start, '%Y') AS year,
        DATE_FORMAT(period_start, '%m') AS month,
        DATE_FORMAT(period_start, '%d') AS day,
        DATE_FORMAT(period_start, '%H') AS hour
      FROM (
        SELECT
          DATE_TRUNC('hour', FROM_UNIXTIME(datetime))
            + INTERVAL '15' MINUTE * CAST(FLOOR(MINUTE(FROM_UNIXTIME(datetime)) / 15) AS INTEGER) AS period_start,
          winddirection,
          windavg,
          windgust,
          pressure,
          airtemperature,
          relativehumidity,
          rainaccumulation,
          uv,
          solarradiation
        FROM ${this.RAW_TABLE}
        WHERE year='${year}'
        AND month='${month}'
        AND day='${day}'
      ) source
      GROUP BY period_start`;
  };

  public static insertDailyRefinedRowsForDate = ({ year, month, day }: { year: string; month: string; day: string }): string => {
    return `
      INSERT INTO ${this.REFINED_DAILY_TABLE}
      SELECT
        DATE_TRUNC('day', FROM_UNIXTIME(datetime)) AS period_start,
        AVG(winddirection) AS winddirection_avg,
        AVG(windavg) AS windavg_avg,
        MAX(windgust) AS windgust_max,
        AVG(pressure) AS pressure_avg,
        AVG(airtemperature) AS airtemperature_avg,
        AVG(relativehumidity) AS relativehumidity_avg,
        SUM(rainaccumulation) AS rainaccumulation_sum,
        AVG(uv) AS uv_avg,
        AVG(solarradiation) AS solarradiation_avg,
        CAST(COUNT(1) AS BIGINT) AS sample_count,
        '${year}' AS year,
        '${month}' AS month
      FROM ${this.RAW_TABLE}
      WHERE year='${year}'
      AND month='${month}'
      AND day='${day}'
      GROUP BY DATE_TRUNC('day', FROM_UNIXTIME(datetime))`;
  };
}
