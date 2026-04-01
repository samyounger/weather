import { datasetFieldOptions } from './field-options';

describe('field-options', () => {
  it('defines selectable fields for raw and refined datasets', () => {
    expect(datasetFieldOptions.raw).toHaveLength(8);
    expect(datasetFieldOptions.refined).toHaveLength(8);
    expect(datasetFieldOptions.raw[0]).toEqual(expect.objectContaining({
      key: 'airtemperature',
      label: 'Temperature',
    }));
    expect(datasetFieldOptions.refined[0]).toEqual(expect.objectContaining({
      key: 'airtemperature_avg',
      label: 'Temperature',
    }));
  });
});
