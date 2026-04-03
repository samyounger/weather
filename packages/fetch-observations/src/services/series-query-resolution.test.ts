import { resolveSeriesQuery } from './series-query-resolution';

describe('resolveSeriesQuery', () => {
  it('honors an explicit 15m override', () => {
    expect(resolveSeriesQuery({
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2028-01-01T00:00:00Z'),
      resolution: '15m',
    })).toEqual({
      aggregationLevel: '15m',
      tableName: 'observations_refined_15m',
    });
  });

  it('honors an explicit daily override', () => {
    expect(resolveSeriesQuery({
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2028-01-01T00:00:00Z'),
      resolution: 'daily',
    })).toEqual({
      aggregationLevel: 'daily',
      tableName: 'observations_refined_daily',
    });
  });

  it('honors an explicit monthly override', () => {
    expect(resolveSeriesQuery({
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2028-01-01T00:00:00Z'),
      resolution: 'monthly',
    })).toEqual({
      aggregationLevel: 'monthly',
      tableName: 'observations_refined_daily',
    });
  });

  it('chooses 15m for short auto ranges', () => {
    expect(resolveSeriesQuery({
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2026-01-07T00:00:00Z'),
      resolution: 'auto',
    })).toEqual({
      aggregationLevel: '15m',
      tableName: 'observations_refined_15m',
    });
  });

  it('chooses daily for medium auto ranges', () => {
    expect(resolveSeriesQuery({
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2026-08-01T00:00:00Z'),
      resolution: 'auto',
    })).toEqual({
      aggregationLevel: 'daily',
      tableName: 'observations_refined_daily',
    });
  });

  it('chooses monthly for long auto ranges', () => {
    expect(resolveSeriesQuery({
      from: new Date('2020-01-01T00:00:00Z'),
      to: new Date('2026-08-01T00:00:00Z'),
      resolution: 'auto',
    })).toEqual({
      aggregationLevel: 'monthly',
      tableName: 'observations_refined_daily',
    });
  });
});
