import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SnapshotRow, SyncAdapter, SyncData, SyncDataError } from '../../sync/sync-adapter';
import { SyncRange } from '../../sync/sync-range';
import { TikTokOAuthClient, TikTokVideo } from './tiktok-oauth.client';
import { TikTokTokenService } from './tiktok-token.service';

function sumAvailable(videos: TikTokVideo[], field: keyof TikTokVideo): number | undefined {
  let total = 0;
  for (const video of videos) {
    const count = video[field];
    if (count === undefined) return undefined;
    total += count;
  }
  if (!Number.isSafeInteger(total)) {
    throw new SyncDataError('La suma de estadísticas de videos de TikTok excede el límite seguro');
  }
  return total;
}

@Injectable()
export class TikTokSyncAdapter implements SyncAdapter {
  readonly platform = 'TIKTOK';
  readonly snapshotsOnly = true;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TikTokTokenService,
    private readonly client: TikTokOAuthClient,
  ) {}

  async fetch(accountId: string, _range: SyncRange): Promise<SyncData> {
    const account = await this.prisma.socialAccount.findFirst({
      where: { id: accountId, platform: 'TIKTOK' },
      select: { platformAccountId: true },
    });
    if (!account) throw new SyncDataError('No se encontró la cuenta de TikTok');

    const accessToken = await this.tokens.getAccessToken(accountId);
    const profile = await this.client.fetchProfile(accessToken);
    if (profile.openId !== account.platformAccountId) {
      throw new SyncDataError('TikTok devolvió una identidad distinta a la cuenta conectada');
    }
    const videos = await this.client.fetchRecentVideos(accessToken);
    const snapshots: SnapshotRow[] = [
      { metric: 'followers', value: profile.followers },
      { metric: 'following', value: profile.following },
      { metric: 'likes', value: profile.likes },
      { metric: 'videoCount', value: profile.videos },
      { metric: 'recentVideoCount', value: videos.length },
    ];
    const videoMetrics: Array<[keyof TikTokVideo, string]> = [
      ['views', 'recentVideoViews'],
      ['likes', 'recentVideoLikes'],
      ['comments', 'recentVideoComments'],
      ['shares', 'recentVideoShares'],
    ];
    for (const [field, metric] of videoMetrics) {
      const value = sumAvailable(videos, field);
      if (value !== undefined) snapshots.push({ metric, value });
    }
    return { dailyMetrics: [], snapshots };
  }
}
