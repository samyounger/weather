import observations from '../../factories/__mocks__/observations.json';
import { DeviceObservationFactory } from "../../factories/device-observation-factory";

export const RESPONSE_DURATION = 1000;

export const DeviceObservationsService = jest.fn().mockImplementation(() => ({
  fetchAndInsertReading: jest.fn().mockImplementation(() => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          insertResult: [{ foo: 'bar' }, { foo: 'bar' }],
          reading: new DeviceObservationFactory().build(observations),
          partitionStatus: { succeeded: 2, failed: 0 },
        });
      }, RESPONSE_DURATION);
    });
  }),
}));
