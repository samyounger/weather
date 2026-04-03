import { getQueryTargetFromPath, OBSERVATIONS_QUERY_TARGET, REFINED_QUERY_TARGET, SERIES_QUERY_TARGET } from './query-target';

describe('getQueryTargetFromPath', () => {
  it('returns the observations target for root', () => {
    expect(getQueryTargetFromPath('/')).toEqual(OBSERVATIONS_QUERY_TARGET);
  });

  it('returns the refined target for refined routes with trailing slashes', () => {
    expect(getQueryTargetFromPath('/refined/')).toEqual(REFINED_QUERY_TARGET);
  });

  it('returns the series target', () => {
    expect(getQueryTargetFromPath('/series')).toEqual(SERIES_QUERY_TARGET);
  });

  it('returns undefined for unsupported paths', () => {
    expect(getQueryTargetFromPath('/unsupported')).toBeUndefined();
  });
});
