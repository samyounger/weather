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

  describe('addObservationsPartitions', () => {
    it('should query athena with the expected batched partition statement', async () => {
      const database = new Database();
      const querySpy = jest.spyOn(database, 'query').mockResolvedValue({ QueryExecutionId: 'query-123' });
      const waitSpy = jest.spyOn(database, 'waitForQuery').mockResolvedValue(QueryExecutionState.SUCCEEDED);

      const result = await database.addObservationsPartitions([
        { year: '2024', month: '08', day: '05', hour: '22' },
        { year: '2024', month: '08', day: '05', hour: '23' },
      ]);

      expect(querySpy).toHaveBeenCalledWith(
        "ALTER TABLE observations ADD IF NOT EXISTS\nPARTITION (year='2024', month='08', day='05', hour='22') LOCATION 's3://weather-tempest-records/year=2024/month=08/day=05/hour=22/'\nPARTITION (year='2024', month='08', day='05', hour='23') LOCATION 's3://weather-tempest-records/year=2024/month=08/day=05/hour=23/';",
      );
      expect(waitSpy).toHaveBeenCalledWith('query-123');
      expect(result).toBe(true);
    });

    it('should return true when there are no partitions to add', async () => {
      const database = new Database();

      await expect(database.addObservationsPartitions([])).resolves.toBe(true);
    });

    it('should return false when athena does not return a query execution id', async () => {
      const database = new Database();
      jest.spyOn(database, 'query').mockResolvedValue({});

      await expect(database.addObservationsPartitions([{ year: '2024', month: '08', day: '05', hour: '22' }])).resolves.toBe(false);
    });

    it('should return false when query does not succeed', async () => {
      const database = new Database();
      jest.spyOn(database, 'query').mockResolvedValue({ QueryExecutionId: 'query-123' });
      jest.spyOn(database, 'waitForQuery').mockResolvedValue(QueryExecutionState.FAILED);

      await expect(database.addObservationsPartitions([{ year: '2024', month: '08', day: '05', hour: '22' }])).resolves.toBe(false);
    });

    it('should return false when query execution throws', async () => {
      const database = new Database();
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
      jest.spyOn(database, 'query').mockRejectedValue(new Error('athena unavailable'));

      await expect(database.addObservationsPartitions([{ year: '2024', month: '08', day: '05', hour: '22' }])).resolves.toBe(false);
      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to add observations partitions',
        expect.objectContaining({
          partitions: [{ year: '2024', month: '08', day: '05', hour: '22' }],
        }),
      );
      errorSpy.mockRestore();
    });
  });

  describe('addObservationsPartition', () => {
    it('should delegate to addObservationsPartitions', async () => {
      const database = new Database();
      const batchSpy = jest.spyOn(database, 'addObservationsPartitions').mockResolvedValue(true);

      const result = await database.addObservationsPartition('2024', '08', '05', '22');

      expect(batchSpy).toHaveBeenCalledWith([{ year: '2024', month: '08', day: '05', hour: '22' }]);
      expect(result).toBe(true);
    });
  });
});
