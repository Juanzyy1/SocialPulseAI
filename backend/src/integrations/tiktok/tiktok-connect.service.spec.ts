import { BadRequestException } from '@nestjs/common';
import { credentialAad, TokenCipherService } from '../../common/crypto/token-cipher.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TikTokConnectService } from './tiktok-connect.service';
import {
  TikTokOAuthClient,
  TikTokProfile,
  TikTokTokens,
} from './tiktok-oauth.client';

class FakeTikTokOAuthClient extends TikTokOAuthClient {
  enabled = true;
  exchangedCodes: string[] = [];
  profile: TikTokProfile = {
    openId: 'open-id',
    displayName: 'Creator',
    avatarUrl: null,
    followers: 2,
    following: 4,
    likes: 8,
    videos: 3,
  };
  tokens: TikTokTokens = {
    accessToken: 'access-secret',
    refreshToken: 'refresh-secret',
    openId: 'open-id',
    scopes: ['user.info.basic', 'user.info.stats', 'video.list'],
    expiresAt: new Date(Date.now() + 7_200_000),
    refreshExpiresAt: new Date(Date.now() + 15_552_000_000),
  };

  buildAuthUrl(state: string): string {
    return `https://www.tiktok.com/authorize?state=${state}`;
  }
  async exchangeCode(code: string): Promise<TikTokTokens> {
    this.exchangedCodes.push(code);
    return this.tokens;
  }
  async refreshToken(): Promise<TikTokTokens> {
    return this.tokens;
  }
  async fetchProfile(): Promise<TikTokProfile> {
    return this.profile;
  }
  async fetchRecentVideos() {
    return [];
  }
  async revokeToken() {}
}

describe('TikTokConnectService', () => {
  const cipher = new TokenCipherService(Buffer.alloc(32, 3));
  const client = new FakeTikTokOAuthClient();
  const createdAccount = {
    id: 'created-account-id',
    platform: 'TIKTOK',
    platformAccountId: 'open-id',
    displayName: 'Creator',
    handle: null,
    avatarUrl: null,
    status: 'ACTIVE',
    connectedAt: new Date(),
    lastSyncedAt: null,
  };
  const tx = {
    socialAccount: {
      findUnique: jest.fn(),
      create: jest.fn().mockResolvedValue(createdAccount),
      update: jest.fn().mockResolvedValue(createdAccount),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (transaction: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  } as unknown as PrismaService;
  let service: TikTokConnectService;

  beforeEach(() => {
    client.enabled = true;
    client.exchangedCodes = [];
    client.profile = {
      openId: 'open-id',
      displayName: 'Creator',
      avatarUrl: null,
      followers: 2,
      following: 4,
      likes: 8,
      videos: 3,
    };
    client.tokens = {
      accessToken: 'access-secret',
      refreshToken: 'refresh-secret',
      openId: 'open-id',
      scopes: ['user.info.basic', 'user.info.stats', 'video.list'],
      expiresAt: new Date(Date.now() + 7_200_000),
      refreshExpiresAt: new Date(Date.now() + 15_552_000_000),
    };
    jest.clearAllMocks();
    tx.socialAccount.findUnique.mockResolvedValue(null);
    tx.socialAccount.create.mockResolvedValue(createdAccount);
    service = new TikTokConnectService(client, prisma, cipher);
  });

  it('genera state aleatorio para proteger el callback OAuth', () => {
    const first = service.start();
    const second = service.start();

    expect(first.cookieValue).not.toBe(second.cookieValue);
    expect(first.cookieValue.length).toBeGreaterThanOrEqual(40);
    expect(new URL(first.url).searchParams.get('state')).toBe(first.cookieValue);
  });

  it('rechaza un state que no coincide y no canjea el código', async () => {
    await expect(
      service.finish('user-id', {
        code: 'code',
        state: 'attacker-state',
        error: undefined,
        cookie: 'browser-state',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(client.exchangedCodes).toEqual([]);
  });

  it('rechaza permisos incompletos antes de consultar el perfil o guardar tokens', async () => {
    client.tokens.scopes = ['user.info.basic', 'video.list'];

    await expect(
      service.finish('user-id', {
        code: 'code',
        state: 'same-state',
        error: undefined,
        cookie: 'same-state',
      }),
    ).rejects.toThrow('user.info.stats');
    expect(tx.socialAccount.create).not.toHaveBeenCalled();
  });

  it('guarda identidad y tokens cifrados con los vencimientos y permisos concedidos', async () => {
    await service.finish('user-id', {
      code: 'authorization-code',
      state: 'same-state',
      error: undefined,
      cookie: 'same-state',
    });

    const data = tx.socialAccount.create.mock.calls[0][0].data;
    expect(data.platform).toBe('TIKTOK');
    expect(data.platformAccountId).toBe('open-id');
    expect(data.credential.create.accessTokenEnc).not.toBe('access-secret');
    expect(data.credential.create.refreshTokenEnc).not.toBe('refresh-secret');
    expect(
      cipher.decrypt(
        data.credential.create.accessTokenEnc,
        credentialAad(data.id, 'access'),
      ),
    ).toBe('access-secret');
    expect(
      cipher.decrypt(
        data.credential.create.refreshTokenEnc,
        credentialAad(data.id, 'refresh'),
      ),
    ).toBe('refresh-secret');
    expect(data.credential.create.refreshExpiresAt).toEqual(client.tokens.refreshExpiresAt);
    expect(data.credential.create.scopes).toEqual(client.tokens.scopes);
  });
});
