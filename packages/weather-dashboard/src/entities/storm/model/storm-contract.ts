import type { StormCase, StormSummary } from '@weather/cloud-computing';

type ObjectValue = Record<string, unknown>;
const object = (value: unknown): value is ObjectValue => !!value && typeof value === 'object';
const number = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const count = (value: unknown, max = Infinity): value is number => number(value) && Number.isInteger(value) && value >= 0 && value <= max;
const nullableNumber = (value: unknown) => value === null || number(value);
const date = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
const timedMetric = (value: unknown, key: string) => value === null ||
  (object(value) && number(value[key]) && date(value.at));

const summary = (value: unknown, year: number): value is StormSummary => {
  if (!object(value) || value.from !== `${year}-01-23T00:00:00.000Z` ||
      value.to !== `${year}-01-26T00:00:00.000Z` || value.expectedMinutes !== 4320 ||
      !count(value.observedMinutes, 4320) || !count(value.rejectedRows) ||
      !count(value.conflictingMinutes, 4320) || !object(value.coverage)) {
    return false;
  }
  const coverage = value.coverage;
  const observed = value.observedMinutes;
  const inWindow = (at: unknown) => date(at) && Date.parse(String(at)) > Date.parse(String(value.from)) &&
    Date.parse(String(at)) <= Date.parse(String(value.to));
  const hourly = value.hourly;
  const episodes = value.episodes;
  return ['gust', 'rain', 'temperature', 'pressure'].every((key) => number(coverage[key]) &&
      Number(coverage[key]) >= 0 && Number(coverage[key]) <= observed / 4320 + 1e-9) &&
    timedMetric(value.peakGust, 'mph') && timedMetric(value.minPressure, 'hpa') && nullableNumber(value.rainMm) &&
    (value.temperature === null || (object(value.temperature) && number(value.temperature.minC) &&
      number(value.temperature.maxC) && value.temperature.minC <= value.temperature.maxC)) &&
    Array.isArray(hourly) && hourly.every((hour) => object(hour) && date(hour.at) &&
      ['gustMph', 'rainMm', 'pressureHpa', 'temperatureC'].every((key) => nullableNumber(hour[key])) &&
      count(hour.minutes, 60) && object(hour.coverageMinutes) &&
      ['gust', 'rain', 'pressure', 'temperature'].every((key) => object(hour.coverageMinutes) &&
        count(hour.coverageMinutes[key], Number(hour.minutes)))) &&
    Array.isArray(episodes) && episodes.length === 3 && [30, 40, 50].every((threshold) => episodes.some((episode: unknown) => (
      object(episode) && episode.thresholdMph === threshold && count(episode.qualifyingMinutes, observed) &&
      count(episode.longestRunMinutes, episode.qualifyingMinutes) &&
      (episode.qualifyingMinutes === 0
        ? episode.firstAt === null && episode.lastAt === null && episode.longestRunMinutes === 0
        : inWindow(episode.firstAt) && inWindow(episode.lastAt) &&
          String(episode.firstAt) <= String(episode.lastAt))
    )));
};

export const parseStormCase = (value: unknown): StormCase => {
  if (!object(value) || value.id !== 'eowyn' || !date(value.retrievedAt) || typeof value.source !== 'string' ||
      !object(value.station) || typeof value.station.name !== 'string' || value.station.timeZone !== 'Europe/London' ||
      !(value.station.historySince === null || date(value.station.historySince)) || !summary(value.event, 2025) ||
      !(value.comparison === null || summary(value.comparison, 2026)) ||
      !(value.comparisonError === null || typeof value.comparisonError === 'string')) {
    throw new Error('The station history response was not recognised. Please retry.');
  }
  return value as unknown as StormCase;
};
