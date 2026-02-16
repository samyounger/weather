export const partitionDatePartsUtc = jest.fn((date: Date) => ({
  year: date.getUTCFullYear().toString(),
  month: (date.getUTCMonth() + 1).toString().padStart(2, '0'),
  day: date.getUTCDate().toString().padStart(2, '0'),
  hour: date.getUTCHours().toString().padStart(2, '0'),
}));

export const partitionDateKeyUtc = jest.fn((date: Date) => {
  const parts = partitionDatePartsUtc(date);

  return `${parts.year}-${parts.month}-${parts.day}-${parts.hour}`;
});
