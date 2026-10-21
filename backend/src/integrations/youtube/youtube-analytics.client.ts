import { Injectable } from '@nestjs/common';

export interface ReportQuery {
  startDate: string;
  endDate: string;
  metrics: readonly string[];
  dimensions?: readonly string[];
  sort?: string;
}

/** Respuesta cruda: el código HTTP y el cuerpo, sin interpretar. */
export interface RawReport {
  statusCode: number;
  body: unknown;
}

/** Totales puntuales del canal (Data API). YouTube los entrega como texto. */
export interface ChannelStatistics {
  viewCount: string | null;
  subscriberCount: string | null;
  videoCount: string | null;
  hiddenSubscriberCount: boolean | null;
}

/** Abstracción del acceso a YouTube Analytics y a los totales del canal. */
export abstract class YoutubeAnalyticsClient {
  /** No lanza en errores HTTP: quien llama decide qué hacer con el código y el cuerpo. */
  abstract queryReport(accessToken: string, query: ReportQuery): Promise<RawReport>;
  abstract fetchChannelStatistics(accessToken: string): Promise<ChannelStatistics | null>;
}

const ANALYTICS_ENDPOINT = 'https://youtubeanalytics.googleapis.com/v2/reports';
const CHANNELS_ENDPOINT = 'https://www.googleapis.com/youtube/v3/channels';
const REQUEST_TIMEOUT_MS = 15_000;

@Injectable()
export class YoutubeAnalyticsClientImpl extends YoutubeAnalyticsClient {
  async queryReport(accessToken: string, query: ReportQuery): Promise<RawReport> {
    const params = new URLSearchParams({
      ids: 'channel==MINE',
      startDate: query.startDate,
      endDate: query.endDate,
      metrics: query.metrics.join(','),
    });
    if (query.dimensions?.length) params.set('dimensions', query.dimensions.join(','));
    if (query.sort) params.set('sort', query.sort);

    const res = await fetch(`${ANALYTICS_ENDPOINT}?${params.toString()}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body: unknown = await res.json().catch(() => null);
    return { statusCode: res.status, body };
  }

  async fetchChannelStatistics(accessToken: string): Promise<ChannelStatistics | null> {
    const res = await fetch(`${CHANNELS_ENDPOINT}?part=statistics&mine=true`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`YouTube respondió ${res.status}`);

    const body = (await res.json()) as {
      items?: Array<{
        statistics?: {
          viewCount?: string;
          subscriberCount?: string;
          videoCount?: string;
          hiddenSubscriberCount?: boolean;
        };
      }>;
    };
    const item = body.items?.[0];
    if (!item) return null;

    const stats = item.statistics ?? {};
    return {
      viewCount: stats.viewCount ?? null,
      subscriberCount: stats.subscriberCount ?? null,
      videoCount: stats.videoCount ?? null,
      hiddenSubscriberCount: stats.hiddenSubscriberCount ?? null,
    };
  }
}