import { DeviceObservationsService } from "./device-observations-service";
import { ObservationsService } from "./observations-service";
import { DeviceObservationFactory } from "../factories/device-observation-factory";
import { Database, Storage } from "@weather/cloud-computing";
import { Device } from "../models";
import { PutObjectCommandOutput } from "@aws-sdk/client-s3";
import { RESPONSE_DURATION } from "./__mocks__/observations-service";
import observations from "../factories/__mocks__/observations.json";
jest.useFakeTimers();

jest.mock('./observations-service');
jest.mock('@weather/cloud-computing');

describe('DeviceObservationsService', () => {
  const debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
  const observationsService = new ObservationsService(new Storage(), new DeviceObservationFactory());
  const addObservationsPartitionsMock = jest.fn().mockResolvedValue(true);
  const database = {
    addObservationsPartitions: addObservationsPartitionsMock,
  };
  const service = new DeviceObservationsService(observationsService, database as unknown as Database);

  describe('fetchAndInsertReading', () => {
    let subject: {
      insertResult: PromiseSettledResult<PutObjectCommandOutput>[];
      reading: Device;
      partitionStatus: {
        succeeded: number;
        failed: number;
      };
    };

    beforeEach(async () => {
      addObservationsPartitionsMock.mockReset();
      addObservationsPartitionsMock.mockResolvedValue(true);
      debugSpy.mockClear();
      const reading = service.fetchAndInsertReading();
      jest.advanceTimersByTime(RESPONSE_DURATION);
      subject = await reading;
    });

    it('should call ObservationsService#readObservation', () => {
      expect(observationsService.readObservation).toHaveBeenCalled();
    });

    it('should call ObservationsService#insertReading', () => {
      expect(observationsService.insertReading).toHaveBeenCalledWith(
        {
          dateTime: 1722896065,
          windLull: 0.68,
          windAvg: 1.18,
          windGust: 1.57,
          windDirection: 227,
          windSampleInterval: 3,
          pressure: 980.7,
          airTemperature: 17.5,
          relativeHumidity: 94,
          illuminance: 0,
          uv: 0,
          solarRadiation: 0,
          rainAccumulation: 0,
          precipitationType: 0,
          avgStrikeDistance: 0,
          strikeCount: 0,
          battery: 2.64,
          reportInterval: 1,
          localDayRainAccumulation: 5.012507,
          ncRainAccumulation: 0,
          localDayNCRainAccumulation: 6.205988,
          precipitationAnalysis: 0,
          deviceId: 123,
        },
        '1722896065.json',
      );
    });

    it('should resolve the insertReading', async () => {
      expect(subject.insertResult).toEqual([
        { status: 'fulfilled', value: { foo: 'bar' } },
        { status: 'fulfilled', value: { foo: 'bar' } },
      ]);
    });

    it('should return an object with insertCount, reading and partitionStatus properties', () => {
      expect(subject).toHaveProperty('insertResult');
      expect(subject).toHaveProperty('reading');
      expect(subject).toHaveProperty('partitionStatus');
    });

    it('should add an athena partition for each hour with observations', () => {
      expect(database.addObservationsPartitions).toHaveBeenCalledTimes(1);
      expect(database.addObservationsPartitions).toHaveBeenCalledWith([
        { year: '2024', month: '08', day: '05', hour: '22' },
        { year: '2040', month: '06', day: '09', hour: '23' },
      ]);
      expect(subject.partitionStatus).toEqual({ succeeded: 2, failed: 0 });
      expect(debugSpy).toHaveBeenCalledWith('athena partitions: ', { succeeded: 2, failed: 0 });
    });

    it('should only add one partition when multiple observations share the same hour', async () => {
      const reading = new DeviceObservationFactory().build({
        ...observations,
        obs: [
          observations.obs[0],
          [1722897000, ...observations.obs[0].slice(1)] as typeof observations.obs[number],
        ],
      });
      (observationsService.readObservation as jest.Mock).mockResolvedValueOnce(reading);
      addObservationsPartitionsMock.mockClear();

      const readingPromise = service.fetchAndInsertReading();
      jest.advanceTimersByTime(RESPONSE_DURATION);
      await readingPromise;

      expect(database.addObservationsPartitions).toHaveBeenCalledTimes(1);
      expect(database.addObservationsPartitions).toHaveBeenCalledWith([
        { year: '2024', month: '08', day: '05', hour: '22' },
      ]);
    });

    it('should log failed partition counts when batch update is unsuccessful', async () => {
      addObservationsPartitionsMock.mockResolvedValueOnce(false);
      debugSpy.mockClear();

      const readingPromise = service.fetchAndInsertReading();
      jest.advanceTimersByTime(RESPONSE_DURATION);
      await readingPromise;

      expect(debugSpy).toHaveBeenCalledWith('athena partitions: ', { succeeded: 0, failed: 2 });
    });

    it('should count failed partitions when batch update throws', async () => {
      addObservationsPartitionsMock.mockRejectedValueOnce(new Error('athena unavailable'));
      debugSpy.mockClear();

      const readingPromise = service.fetchAndInsertReading();
      jest.advanceTimersByTime(RESPONSE_DURATION);
      await expect(readingPromise).resolves.toBeDefined();

      expect(debugSpy).toHaveBeenCalledWith('athena partitions: ', { succeeded: 0, failed: 2 });
    });
  });
});
