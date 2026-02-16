export type PartitionDateParts = {
  year: string;
  month: string;
  day: string;
  hour: string;
};

export const partitionDatePartsUtc = (date: Date): PartitionDateParts => {
  const year = date.getUTCFullYear().toString();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = date.getUTCDate().toString().padStart(2, '0');
  const hour = date.getUTCHours().toString().padStart(2, '0');

  return { year, month, day, hour };
};

export const partitionDateKeyUtc = (date: Date): string => {
  const parts = partitionDatePartsUtc(date);

  return `${parts.year}-${parts.month}-${parts.day}-${parts.hour}`;
};
