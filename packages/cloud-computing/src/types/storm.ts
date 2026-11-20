export type StormSample = {
  at: string;
  gustMph: number | null;
  rainMm: number | null;
  temperatureC: number | null;
  pressureHpa: number | null;
};

export type StormSummary = {
  from: string;
  to: string;
  expectedMinutes: number;
  observedMinutes: number;
  rejectedRows: number;
  conflictingMinutes: number;
  coverage: { gust: number; rain: number; temperature: number; pressure: number };
  peakGust: { mph: number; at: string } | null;
  rainMm: number | null;
  temperature: { minC: number; maxC: number } | null;
  minPressure: { hpa: number; at: string } | null;
  hourly: {
    at: string; gustMph: number | null; rainMm: number | null;
    pressureHpa: number | null; temperatureC: number | null; minutes: number;
    coverageMinutes: { gust: number; rain: number; pressure: number; temperature: number };
  }[];
  episodes: {
    thresholdMph: number; qualifyingMinutes: number; longestRunMinutes: number;
    firstAt: string | null; lastAt: string | null;
  }[];
};

export type StormCase = {
  id: 'eowyn';
  retrievedAt: string;
  station: { name: string; timeZone: 'Europe/London'; historySince: string | null };
  event: StormSummary;
  comparison: StormSummary | null;
  comparisonError: string | null;
  source: string;
};
