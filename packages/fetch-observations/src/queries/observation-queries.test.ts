import { ObservationQueries } from "./observation-queries";

describe('ObservationQueries', () => {
  describe('.getObservationsByDateRange', () => {
    it('returns a SQL query string with datetime and partition predicates', () => {
      const dateProps = {
        fields: ['winddirection', 'airtemperature'],
        from: new Date('2026-02-19T00:15:00Z'),
        to: new Date('2026-02-19T02:20:00Z'),
        fromEpochSeconds: 1771460100,
        toEpochSeconds: 1771467600,
        limit: 25,
      };

      const subject = ObservationQueries.getObservationsByDateRange(dateProps);

      expect(subject).toEqual(`
      SELECT winddirection,airtemperature FROM observations
      WHERE datetime >= 1771460100
      AND datetime <= 1771467600
      AND ((year='2026' AND month='02' AND day='19' AND hour='00') OR (year='2026' AND month='02' AND day='19' AND hour='01') OR (year='2026' AND month='02' AND day='19' AND hour='02'))
      ORDER BY datetime ASC LIMIT 25;`);
    });
  });

  describe('.getRefinedByDateRange', () => {
    it('returns a SQL query string for refined 15-minute rows', () => {
      const dateProps = {
        fields: ['period_start', 'windavg_avg'],
        from: new Date('2026-02-19T00:15:00Z'),
        to: new Date('2026-02-19T02:20:00Z'),
        fromEpochSeconds: 1771460100,
        toEpochSeconds: 1771467600,
        limit: 25,
      };

      const subject = ObservationQueries.getRefinedByDateRange(dateProps);

      expect(subject).toEqual(`
      SELECT period_start,windavg_avg FROM observations_refined_15m
      WHERE period_start >= FROM_UNIXTIME(1771460100)
      AND period_start <= FROM_UNIXTIME(1771467600)
      AND ((year='2026' AND month='02' AND day='19' AND hour='00') OR (year='2026' AND month='02' AND day='19' AND hour='01') OR (year='2026' AND month='02' AND day='19' AND hour='02'))
      ORDER BY period_start ASC LIMIT 25;`);
    });
  });

  describe('.getDailySeriesByDateRange', () => {
    it('returns a SQL query string for daily rows', () => {
      const dateProps = {
        fields: ['period_start', 'windavg_avg'],
        from: new Date('2026-02-01T00:00:00Z'),
        to: new Date('2026-03-15T02:20:00Z'),
        fromEpochSeconds: 1770076800,
        toEpochSeconds: 1773550800,
        limit: 100,
      };

      const subject = ObservationQueries.getDailySeriesByDateRange(dateProps);

      expect(subject).toContain('FROM observations_refined_daily');
      expect(subject).toContain("(year='2026' AND month='02') OR (year='2026' AND month='03')");
    });
  });

  describe('.getMonthlySeriesByDateRange', () => {
    it('returns a SQL query string for monthly rollups from daily rows', () => {
      const dateProps = {
        fields: ['period_start', 'airtemperature_avg', 'rainaccumulation_sum'],
        from: new Date('2020-02-01T00:00:00Z'),
        to: new Date('2026-03-15T02:20:00Z'),
        fromEpochSeconds: 1580515200,
        toEpochSeconds: 1773550800,
        limit: 100,
      };

      const subject = ObservationQueries.getMonthlySeriesByDateRange(dateProps);

      expect(subject).toContain("DATE_TRUNC('month', period_start) AS period_start");
      expect(subject).toContain('AVG(airtemperature_avg) AS airtemperature_avg');
      expect(subject).toContain('SUM(rainaccumulation_sum) AS rainaccumulation_sum');
      expect(subject).toContain('GROUP BY DATE_TRUNC(\'month\', period_start)');
    });
  });
});
