import { datasetFieldOptions } from './field-options';

describe('field-options', () => {
  it('defines selectable fields for series datasets', () => {
    expect(datasetFieldOptions.series).toHaveLength(8);
    expect(datasetFieldOptions.series[0]).toEqual(expect.objectContaining({
      key: 'airtemperature_avg',
      label: 'Temperature',
      unitLabel: 'degrees centigrade',
    }));
  });
});
