import type { StormSummary } from '@weather/cloud-computing';
import { coverageText, formatValue, gustComparison, localTime } from './storm-format';
import { sourceFor, stormMilestones, stormSources } from './storm-evidence';

const summary = (mph: number | null, coverage = 1) => ({
  peakGust: mph === null ? null : { mph, at: '2025-01-24T12:00:00Z' },
  coverage: { gust: coverage },
}) as StormSummary;

describe('storm presentation', () => {
  it('formats UK units, missing values and per-metric coverage without making null zero', () => {
    expect(formatValue(null, 'mm')).toBe('Unavailable');
    expect(formatValue(0, 'mm')).toBe('0.0 mm');
    expect(formatValue(1.25)).toBe('1.3');
    expect(coverageText(0.975)).toBe('97.5% minute coverage');
  });

  it('uses Europe/London regardless of viewer zone, including DST', () => {
    expect(localTime('2025-01-24T12:00:00Z')).toContain('12:00');
    expect(localTime('2025-07-24T12:00:00Z')).toContain('13:00');
  });

  it('gates comparisons for missing data and insufficient coverage', () => {
    expect(gustComparison(summary(null), summary(10))).toContain('Not enough');
    expect(gustComparison(summary(10), summary(null))).toContain('Not enough');
    expect(gustComparison(summary(10, 0.94), summary(10))).toContain('95%');
    expect(gustComparison(summary(10), summary(10, 0.94))).toContain('95%');
  });

  it('describes comparable measured peaks without claiming a climate normal or record', () => {
    expect(gustComparison(summary(60), summary(40))).toContain('20.0 mph higher');
    expect(gustComparison(summary(20), summary(40))).toContain('20.0 mph lower');
    expect(gustComparison(summary(40), summary(40.05))).toContain('about the same');
  });

  it('resolves every timeline milestone to free primary evidence', () => {
    for (const item of stormMilestones) {
      expect(sourceFor(item.source).url).toMatch(/^https:\/\/(www\.metoffice\.gov\.uk|www\.gov\.uk)\//);
    }
    expect(stormSources).toHaveLength(5);
  });
});
