import { Injectable } from '@nestjs/common';
import { SyncRange } from '../../sync/sync-range';
import { addDays } from '../../common/dates/pacific-date';
import { INSTAGRAM_GRAPH_API_VERSION } from './instagram-oauth.client';

const GRAPH_API = `https://graph.facebook.com/${INSTAGRAM_GRAPH_API_VERSION}`;
const REQUEST_TIMEOUT_MS = 10_000;

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
      throw new Error(`Meta rechazó la consulta de Insights (${response.status})`);
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
