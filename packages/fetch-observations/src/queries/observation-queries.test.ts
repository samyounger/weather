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
});
