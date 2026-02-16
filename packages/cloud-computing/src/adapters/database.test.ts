import { QueryExecutionState } from "@aws-sdk/client-athena";
import { Database } from "./database";

const nodeEnv = process.env.NODE_ENV;

describe('Database', () => {
  beforeAll(() => {
    process.env.NODE_ENV = 'production';
  });

  afterAll(() => {
    process.env.NODE_ENV = nodeEnv;
  });

  describe('addObservationsPartition', () => {
    it('should query athena with the expected partition statement', async () => {
      const database = new Database();
      const querySpy = jest.spyOn(database, 'query').mockResolvedValue({ QueryExecutionId: 'query-123' });
      const waitSpy = jest.spyOn(database, 'waitForQuery').mockResolvedValue(QueryExecutionState.SUCCEEDED);

      const result = await database.addObservationsPartition('2024', '08', '05', '22');

      expect(querySpy).toHaveBeenCalledWith(
        "ALTER TABLE observations ADD IF NOT EXISTS PARTITION (year='2024', month='08', day='05', hour='22') LOCATION 's3://weather-tempest-records/year=2024/month=08/day=05/hour=22/';",
      );
      expect(waitSpy).toHaveBeenCalledWith('query-123');
      expect(result).toBe(true);
    });

    it('should return false when athena does not return a query execution id', async () => {
      const database = new Database();
      jest.spyOn(database, 'query').mockResolvedValue({});

      await expect(database.addObservationsPartition('2024', '08', '05', '22')).resolves.toBe(false);
    });

    it('should return false when query does not succeed', async () => {
      const database = new Database();
      jest.spyOn(database, 'query').mockResolvedValue({ QueryExecutionId: 'query-123' });
      jest.spyOn(database, 'waitForQuery').mockResolvedValue(QueryExecutionState.FAILED);

      await expect(database.addObservationsPartition('2024', '08', '05', '22')).resolves.toBe(false);
    });

    it('should return false when query execution throws', async () => {
      const database = new Database();
      jest.spyOn(database, 'query').mockRejectedValue(new Error('athena unavailable'));

      await expect(database.addObservationsPartition('2024', '08', '05', '22')).resolves.toBe(false);
    });
  });
});
