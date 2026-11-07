import { Injectable } from '@nestjs/common';
import { dailyMetricCodes } from '../../analytics/metric-catalog';
import { extractApiError, parseReportTable } from '../../analytics/report-parser';
import { SyncAdapter, SyncData, SyncDataError } from '../../sync/sync-adapter';
import { SyncRange } from '../../sync/sync-range';
import { statsToSnapshots, tableToMetricRows } from '../../sync/youtube-sync.mapper';
import { YoutubeAnalyticsClient } from './youtube-analytics.client';
import { YoutubeTokenService } from './youtube-token.service';

@Injectable()
export class YoutubeSyncAdapter implements SyncAdapter {
  readonly platform = 'YOUTUBE';

  constructor(
    private readonly tokens: YoutubeTokenService,
    private readonly analytics: YoutubeAnalyticsClient,
  ) {}

  async fetch(accountId: string, range: SyncRange): Promise<SyncData> {
    const accessToken = await this.tokens.getAccessToken(accountId);
    const metrics = dailyMetricCodes(this.platform);
    const report = await this.analytics.queryReport(accessToken, {
      startDate: range.start,
      endDate: range.end,
      metrics,
      dimensions: ['day'],
      sort: 'day',
    });
    if (report.statusCode !== 200) {
      throw new SyncDataError(
        `YouTube Analytics respondió ${report.statusCode}: ${extractApiError(report.body)}`,
      );
    }

    const table = parseReportTable(report.body);
    if (!table) {
      throw new SyncDataError('La respuesta de YouTube Analytics tiene un formato inesperado');
    }
    const dailyMetrics = tableToMetricRows(table, metrics, range);

    const stats = await this.analytics.fetchChannelStatistics(accessToken);
    if (!stats) throw new SyncDataError('La cuenta de Google ya no tiene un canal de YouTube');

    return { dailyMetrics, snapshots: statsToSnapshots(stats) };
  }
}
