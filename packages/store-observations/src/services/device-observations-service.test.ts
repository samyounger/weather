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
  const addObservationsPartitionMock: jest.MockedFunction<Database['addObservationsPartition']> = jest.fn().mockResolvedValue(true);
  const database: Pick<Database, 'addObservationsPartition'> = {
    addObservationsPartition: addObservationsPartitionMock,
  };
  const service = new DeviceObservationsService(observationsService, database as unknown as Database);

  describe('fetchAndInsertReading', () => {
    let subject:  { insertResult: PromiseSettledResult<PutObjectCommandOutput>[], reading: Device };

    beforeEach(async () => {
      addObservationsPartitionMock.mockReset();
      addObservationsPartitionMock.mockResolvedValue(true);
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

    it('should return an object with insertCount and reading properties', () => {
      expect(subject).toHaveProperty('insertResult');
      expect(subject).toHaveProperty('reading');
    });

    it('should add an athena partition for each hour with observations', () => {
      expect(database.addObservationsPartition).toHaveBeenNthCalledWith(1, '2024', '08', '05', '22');
      expect(database.addObservationsPartition).toHaveBeenNthCalledWith(2, '2040', '06', '09', '23');
      expect(database.addObservationsPartition).toHaveBeenCalledTimes(2);
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
      addObservationsPartitionMock.mockClear();

      const readingPromise = service.fetchAndInsertReading();
      jest.advanceTimersByTime(RESPONSE_DURATION);
      await readingPromise;

      expect(database.addObservationsPartition).toHaveBeenCalledTimes(1);
      expect(database.addObservationsPartition).toHaveBeenCalledWith('2024', '08', '05', '22');
    });

    it('should log succeeded and failed partition counts', async () => {
      addObservationsPartitionMock
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);
      debugSpy.mockClear();

      const readingPromise = service.fetchAndInsertReading();
      jest.advanceTimersByTime(RESPONSE_DURATION);
      await readingPromise;

      expect(debugSpy).toHaveBeenCalledWith('athena partitions: ', { succeeded: 1, failed: 1 });
    });
  });
});
