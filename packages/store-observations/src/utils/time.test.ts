import { dateStartEndSeconds, formatDateToString } from "./time";

describe('time', () => {
  describe('formatDateToString', () => {
    beforeEach(() => {
      jest
        .useFakeTimers()
        .setSystemTime(new Date('2020-01-01T11:32:56Z'));
    });

    it('should return the date in format YYYY-MM-DD', () => {
      expect(formatDateToString(new Date())).toEqual('year=2020/month=01/day=01/hour=11/');
    });
  });

  describe('dateStartEndSeconds', () => {
    it('should return the start and end of the day in seconds', () => {
      const date = new Date('2020-01-01');
      const { start, end } = dateStartEndSeconds(date);

      expect(start).toEqual(1577836800);
      expect(end).toEqual(1577923199);
    });
  });
});
