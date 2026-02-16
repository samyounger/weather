import { partitionDateKeyUtc, partitionDatePartsUtc } from './partition-date-parts';

describe('partition-date-parts', () => {
  it('should return UTC partition parts', () => {
    const subject = partitionDatePartsUtc(new Date('2026-02-16T03:04:05.000Z'));

    expect(subject).toEqual({
      year: '2026',
      month: '02',
      day: '16',
      hour: '03',
    });
  });

  it('should return UTC partition key', () => {
    const subject = partitionDateKeyUtc(new Date('2026-02-16T03:04:05.000Z'));

    expect(subject).toEqual('2026-02-16-03');
  });
});
