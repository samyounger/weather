import type { StormCase } from '@weather/cloud-computing';
import type { RuntimeConfig } from '../../../shared/config/runtime-config';
import type { AuthTokens } from '../../session/model/session';
import { parseStormCase } from '../model/storm-contract';

export const fetchStormCase = async (
  config: RuntimeConfig, session: AuthTokens, signal?: AbortSignal,
): Promise<StormCase> => {
  if (config.mockMode) {
    // Explicitly empty local demo: never pretend synthetic data is station history.
    const empty = {
      from: '2025-01-23T00:00:00.000Z', to: '2025-01-26T00:00:00.000Z',
      expectedMinutes: 4320, observedMinutes: 0, rejectedRows: 0, conflictingMinutes: 0,
      coverage: { gust: 0, rain: 0, temperature: 0, pressure: 0 },
      peakGust: null, rainMm: null, temperature: null, minPressure: null,
      hourly: [], episodes: [30, 40, 50].map((thresholdMph) => ({
        thresholdMph, qualifyingMinutes: 0, longestRunMinutes: 0, firstAt: null, lastAt: null,
      })),
    };
    return {
      id: 'eowyn', retrievedAt: new Date().toISOString(),
      station: { name: 'Local demonstration — no station observations', timeZone: 'Europe/London', historySince: null },
      event: empty, comparison: null, comparisonError: 'No reference observations in local demonstration mode.',
      source: 'Local demonstration, not real observations',
    };
  }
  const deadline = AbortSignal.timeout(25_000);
  const controller = new AbortController();
  const sources = signal ? [signal, deadline] : [deadline];
  const forwardAbort = () => controller.abort();
  for (const source of sources) {
    if (source.aborted) {
      forwardAbort();
    } else {
      source.addEventListener('abort', forwardAbort, { once: true });
    }
  }
  try {
    const response = await fetch(`${config.apiBaseUrl}/storms/eowyn`, {
      signal: controller.signal, headers: { Authorization: `Bearer ${session.idToken}` },
    });
    if (!response.ok) {
      throw new Error(response.status === 401 || response.status === 403
        ? 'Your session has expired. Sign out and sign in to load station history.'
        : 'Station history is temporarily unavailable. Please retry.');
    }
    return parseStormCase(await response.json());
  } catch (error) {
    if (deadline.aborted) {
      throw new Error('Station history request timed out. Please retry.');
    }
    throw error;
  } finally {
    for (const source of sources) {
      source.removeEventListener('abort', forwardAbort);
    }
  }
};
