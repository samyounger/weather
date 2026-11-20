import type { StormSample, StormSummary } from '@weather/cloud-computing';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const MPH_PER_MPS = 2.2369362920544;

const measurement = (value: unknown, min: number, max: number): number | null => (
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null
);
const round = (value: number) => Math.round(value * 100) / 100;

export const summariseStorm = (rawRows: unknown[], from: string, to: string): StormSummary => {
  const start = Date.parse(from);
  const end = Date.parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start ||
      (end - start) % MINUTE_MS !== 0 || end - start > 3 * 24 * HOUR_MS) {
    throw new Error('Invalid fixed observation window');
  }
  const samples = new Map<number, StormSample>();
  const signatures = new Map<number, string>();
  const conflicts = new Set<number>();
  let rejectedRows = 0;
  for (const row of rawRows) {
    if (!Array.isArray(row) || typeof row[0] !== 'number' || !Number.isFinite(row[0]) ||
        row[17] !== 1 || row[0] * 1000 % MINUTE_MS !== 0) {
      rejectedRows++;
      continue;
    }
    const timestamp = row[0] * 1000;
    // Each report covers the minute ending at its timestamp; exclude the preceding day's last interval.
    if (timestamp <= start || timestamp > end) {
      continue;
    }
    const gust = measurement(row[3], 0, 150);
    const sample: StormSample = {
      at: new Date(timestamp).toISOString(),
      gustMph: gust === null ? null : gust * MPH_PER_MPS,
      rainMm: measurement(row[12], 0, 100),
      temperatureC: measurement(row[7], -100, 70),
      pressureHpa: measurement(row[6], 800, 1100),
    };
    const signature = JSON.stringify(sample);
    if (signatures.has(timestamp) && signatures.get(timestamp) !== signature) {
      conflicts.add(timestamp);
      samples.delete(timestamp);
    } else if (!conflicts.has(timestamp)) {
      signatures.set(timestamp, signature);
      samples.set(timestamp, sample);
    }
  }
  const ordered = [...samples.values()].sort((a, b) => a.at.localeCompare(b.at));
  const expectedMinutes = (end - start) / MINUTE_MS;
  const gusts = ordered.filter((s) => s.gustMph !== null);
  const rains = ordered.filter((s) => s.rainMm !== null);
  const temperatures = ordered.filter((s) => s.temperatureC !== null);
  const pressures = ordered.filter((s) => s.pressureHpa !== null);
  const peak = gusts.reduce<StormSample | null>((best, s) => (
    !best || s.gustMph! > best.gustMph! ? s : best
  ), null);
  const low = pressures.reduce<StormSample | null>((best, s) => (
    !best || s.pressureHpa! < best.pressureHpa! ? s : best
  ), null);
  const byHour = new Map<number, StormSample[]>();
  for (const sample of ordered) {
    const hour = Math.floor((Date.parse(sample.at) - 1) / HOUR_MS) * HOUR_MS;
    const group = byHour.get(hour) ?? [];
    group.push(sample);
    byHour.set(hour, group);
  }
  const hourly: StormSummary['hourly'] = [];
  for (let hour = start; hour < end; hour += HOUR_MS) {
    const group = byHour.get(hour) ?? [];
    const values = (field: keyof Omit<StormSample, 'at'>) => (
      group.map((s) => s[field]).filter((v): v is number => v !== null)
    );
    const hourGust = values('gustMph');
    const hourRain = values('rainMm');
    const hourPressure = values('pressureHpa');
    const hourTemperature = values('temperatureC');
    hourly.push({
      at: new Date(hour).toISOString(), minutes: group.length,
      coverageMinutes: { gust: hourGust.length, rain: hourRain.length, pressure: hourPressure.length, temperature: hourTemperature.length },
      gustMph: hourGust.length ? round(Math.max(...hourGust)) : null,
      // Partial hours have an observed subtotal, not an imputed whole-hour total.
      rainMm: hourRain.length ? round(hourRain.reduce((sum, v) => sum + v, 0)) : null,
      pressureHpa: hourPressure.length ? round(hourPressure.reduce((sum, v) => sum + v, 0) / hourPressure.length) : null,
      temperatureC: hourTemperature.length ? round(hourTemperature.reduce((sum, v) => sum + v, 0) / hourTemperature.length) : null,
    });
  }
  const episodes = [30, 40, 50].map((thresholdMph) => {
    const qualifying = gusts.filter((s) => s.gustMph! >= thresholdMph);
    let longestRunMinutes = 0;
    let run = 0;
    let previous = -Infinity;
    for (const sample of qualifying) {
      const at = Date.parse(sample.at);
      run = at - previous === MINUTE_MS ? run + 1 : 1;
      longestRunMinutes = Math.max(longestRunMinutes, run);
      previous = at;
    }
    return {
      thresholdMph, qualifyingMinutes: qualifying.length, longestRunMinutes,
      firstAt: qualifying[0]?.at ?? null, lastAt: qualifying[qualifying.length - 1]?.at ?? null,
    };
  });
  return {
    from, to, expectedMinutes, observedMinutes: ordered.length, rejectedRows,
    conflictingMinutes: conflicts.size,
    coverage: {
      gust: gusts.length / expectedMinutes, rain: rains.length / expectedMinutes,
      temperature: temperatures.length / expectedMinutes, pressure: pressures.length / expectedMinutes,
    },
    peakGust: peak ? { mph: round(peak.gustMph!), at: peak.at } : null,
    rainMm: rains.length ? round(rains.reduce((sum, s) => sum + s.rainMm!, 0)) : null,
    temperature: temperatures.length ? {
      minC: Math.min(...temperatures.map((s) => s.temperatureC!)),
      maxC: Math.max(...temperatures.map((s) => s.temperatureC!)),
    } : null,
    minPressure: low ? { hpa: low.pressureHpa!, at: low.at } : null,
    hourly, episodes,
  };
};
