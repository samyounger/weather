import type { StormSummary } from '@weather/cloud-computing';

export const localTime = (value: string) => new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
}).format(new Date(value));

export const formatValue = (value: number | null, unit = '') => value === null
  ? 'Unavailable'
  : `${value.toFixed(1)}${unit ? ' ' + unit : ''}`;

export const coverageText = (fraction: number) => `${(fraction * 100).toFixed(1)}% minute coverage`;

export const gustComparison = (event: StormSummary, reference: StormSummary): string => {
  if (!event.peakGust || !reference.peakGust || event.coverage.gust < 0.95 || reference.coverage.gust < 0.95) {
    return 'Not enough gust coverage in both periods for a reliable comparison (95% required).';
  }
  const difference = event.peakGust.mph - reference.peakGust.mph;
  if (Math.abs(difference) < 0.1) {
    return 'The highest measured gust was about the same in the two periods.';
  }
  return `The highest measured gust during Éowyn was ${Math.abs(difference).toFixed(1)} mph ${difference > 0 ? 'higher' : 'lower'} than in the 2026 reference period.`;
};
