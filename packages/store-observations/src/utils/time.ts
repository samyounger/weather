import { partitionDatePartsUtc } from "@weather/cloud-computing";

/*
 * Format date to string in format 'YYYY/MM/DD/'
 * @param {Date} date
 * @returns {string}
 */
export const formatDateToString = (date: Date): string => {
  const { year, month, day, hour } = partitionDatePartsUtc(date);

  return `year=${year}/month=${month}/day=${day}/hour=${hour}/`;
};

/*
 * Get start and end seconds of a day
 * @param {Date} date
 * @returns {object}
 */
export const dateStartEndSeconds = (date: Date): { start: number, end: number } => {
  const startTime = Math.floor(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0,
    0,
    0,
    0,
  ) / 1000);
  const endTime = Math.floor(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    23,
    59,
    59,
    999,
  ) / 1000);

  return { start: startTime, end: endTime };
};

/*
 * Convert unix timestamp to Date object
 * @param {number} unix
 * @returns {Date}
 */
export const unixToDateTime = (unix: number): Date => (
  new Date(unix * 1000)
);
