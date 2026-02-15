import { RefinementQueries } from './refinement-queries';

describe('RefinementQueries', () => {
  it('should create refined observations table query', () => {
    const subject = RefinementQueries.createRefinedTable();

    expect(subject).toContain('CREATE EXTERNAL TABLE IF NOT EXISTS observations_refined_15m');
    expect(subject).toContain("LOCATION 's3://weather-tempest-records/refined/observations_refined_15m/'");
  });

  it('should create existing rows query for a specific date', () => {
    const subject = RefinementQueries.existingRowsForDate({ year: '2026', month: '02', day: '14' });

    expect(subject).toContain("FROM observations_refined_15m");
    expect(subject).toContain("WHERE year='2026'");
    expect(subject).toContain("AND month='02'");
    expect(subject).toContain("AND day='14'");
  });

  it('should create insert query for a specific date', () => {
    const subject = RefinementQueries.insertRefinedRowsForDate({ year: '2026', month: '02', day: '14' });

    expect(subject).toContain('INSERT INTO observations_refined_15m');
    expect(subject).toContain("FROM observations");
    expect(subject).toContain("WHERE year='2026'");
    expect(subject).toContain("AND month='02'");
    expect(subject).toContain("AND day='14'");
  });
});
