import { PrismaService } from '../../prisma/prisma.service';
import { TikTokOAuthClient, TikTokProfile, TikTokVideo } from './tiktok-oauth.client';
import { TikTokSyncAdapter } from './tiktok-sync.adapter';
import { TikTokTokenService } from './tiktok-token.service';

class FakeTikTokClient extends TikTokOAuthClient {
  enabled = true;
  profile: TikTokProfile = {
    openId: 'open-id',
    displayName: 'Creator',
    avatarUrl: null,
    followers: 2,
    following: 4,
    likes: 8,
    videos: 3,
  };
  videos: TikTokVideo[] = [
    { views: 10, likes: 2, comments: 1, shares: 3 },
    { views: 20, likes: 4, comments: 2, shares: 5 },
  ];

  buildAuthUrl(): string {
    return '';
  }
  async exchangeCode() {
    throw new Error('not used');
  }
  async refreshToken() {
    throw new Error('not used');
  }
  async fetchProfile() {
    return this.profile;
  }
  async fetchRecentVideos() {
    return this.videos;
  }
  async revokeToken() {}
}

describe('TikTokSyncAdapter', () => {
  it('convierte estadísticas de perfil y sumas de hasta 20 videos en capturas, no series diarias', async () => {
    const prisma = {
      socialAccount: {
        findFirst: jest.fn().mockResolvedValue({ platformAccountId: 'open-id' }),
      },
    } as unknown as PrismaService;
    const tokens = {
      getAccessToken: jest.fn().mockResolvedValue('access-token'),
    } as unknown as TikTokTokenService;
    const client = new FakeTikTokClient();
    const adapter = new TikTokSyncAdapter(prisma, tokens, client);

    const result = await adapter.fetch('account-id', {
      start: '2026-11-07',
      end: '2026-11-07',
      kind: 'incremental',
    });

    expect(adapter.snapshotsOnly).toBe(true);
    expect(result.dailyMetrics).toEqual([]);
    expect(result.snapshots).toEqual([
      { metric: 'followers', value: 2 },
      { metric: 'following', value: 4 },
      { metric: 'likes', value: 8 },
      { metric: 'videoCount', value: 3 },
      { metric: 'recentVideoCount', value: 2 },
      { metric: 'recentVideoViews', value: 30 },
      { metric: 'recentVideoLikes', value: 6 },
      { metric: 'recentVideoComments', value: 3 },
      { metric: 'recentVideoShares', value: 8 },
    ]);
  });

  it('omite una suma si TikTok no devolvió alguno de los contadores', async () => {
    const prisma = {
      socialAccount: {
        findFirst: jest.fn().mockResolvedValue({ platformAccountId: 'open-id' }),
      },
    } as unknown as PrismaService;
    const tokens = {
      getAccessToken: jest.fn().mockResolvedValue('access-token'),
    } as unknown as TikTokTokenService;
    const client = new FakeTikTokClient();
    client.videos = [{ views: 10, likes: 2, comments: 1 }];
    const adapter = new TikTokSyncAdapter(prisma, tokens, client);

    const result = await adapter.fetch('account-id', {
      start: '2026-11-07',
      end: '2026-11-07',
      kind: 'incremental',
    });

    expect(result.snapshots).not.toContainEqual(
      expect.objectContaining({ metric: 'recentVideoShares' }),
    );
  });
});
