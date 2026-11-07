import { Injectable } from '@nestjs/common';
import { redactSecrets } from '../../common/logging/redact';
import { SyncRange } from '../../sync/sync-range';
import { addDays } from '../../common/dates/pacific-date';
import { INSTAGRAM_GRAPH_API_VERSION } from './instagram-oauth.client';

const GRAPH_API = `https://graph.facebook.com/${INSTAGRAM_GRAPH_API_VERSION}`;
const REQUEST_TIMEOUT_MS = 10_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describeMetaError(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.error)) return null;
  const { message, code, error_subcode: subcode } = value.error;
  const parts: string[] = [];
  if (typeof message === 'string' && message.length > 0) {
    parts.push(redactSecrets(message.replace(/\s+/g, ' ')));
  }
  if (typeof code === 'number' || typeof code === 'string') parts.push(`código ${code}`);
  if (typeof subcode === 'number' || typeof subcode === 'string') {
    parts.push(`subcódigo ${subcode}`);
  }
  return parts.length > 0 ? parts.join(', ') : null;
}

export abstract class InstagramInsightsClient {
  abstract fetchDailyReach(
    accessToken: string,
    instagramAccountId: string,
    range: SyncRange,
  ): Promise<unknown>;
}

@Injectable()
export class InstagramInsightsClientImpl extends InstagramInsightsClient {
  async fetchDailyReach(
    accessToken: string,
    instagramAccountId: string,
    range: SyncRange,
  ): Promise<unknown> {
    const query = new URLSearchParams({
      metric: 'reach',
      period: 'day',
      metric_type: 'time_series',
      since: String(pacificMidnight(range.start) / 1000),
      until: String(pacificMidnight(addDays(range.end, 1)) / 1000),
      access_token: accessToken,
    });
    const response = await fetch(
      `${GRAPH_API}/${encodeURIComponent(instagramAccountId)}/insights?${query.toString()}`,
      { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) },
    );
    if (!response.ok) {
      let payload: unknown = null;
      try {
        payload = await response.json();
      } catch {
        // Graph API can return an empty or non-JSON body for an HTTP error.
      }
      const detail = describeMetaError(payload);
      throw new Error(
        `Meta rechazó la consulta de Insights (${response.status})${detail ? `: ${detail}` : ''}`,
      );
    }
    return response.json();
  }
}

function pacificMidnight(date: string): number {
  const desiredUtc = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(desiredUtc)) throw new Error('Fecha de sincronización inválida');

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  let instant = desiredUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(instant)).map(({ type, value }) => [type, value]),
    );
    const representedUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    const difference = desiredUtc - representedUtc;
    instant += difference;
    if (difference === 0) break;
  }
  return instant;
}
