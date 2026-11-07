import { credentialAad, TokenCipherService } from '../../common/crypto/token-cipher.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TikTokOAuthClient, TikTokOAuthError, TikTokTokens } from './tiktok-oauth.client';
import { TikTokTokenService } from './tiktok-token.service';

class FakeTikTokOAuthClient extends TikTokOAuthClient {
  enabled = true;
  refreshed: TikTokTokens = {
    accessToken: 'new-access',
    refreshToken: 'new-refresh',
    openId: 'open-id',
    scopes: ['user.info.basic', 'user.info.stats', 'video.list'],
    expiresAt: new Date(Date.now() + 7_200_000),
    refreshExpiresAt: new Date(Date.now() + 15_552_000_000),
  };
  refreshError: Error | null = null;
  refreshCalls = 0;

  buildAuthUrl(): string {
    return '';
  }
  async exchangeCode(): Promise<TikTokTokens> {
    throw new Error('not used');
  }
  async refreshToken(): Promise<TikTokTokens> {
    this.refreshCalls += 1;
    if (this.refreshError) throw this.refreshError;
    return this.refreshed;
  }
  async fetchProfile() {
    throw new Error('not used');
  }
  async fetchRecentVideos() {
    throw new Error('not used');
  }
  async revokeToken() {}
}

describe('TikTokTokenService', () => {
  const accountId = 'account-id';
  const cipher = new TokenCipherService(Buffer.alloc(32, 7));
  const client = new FakeTikTokOAuthClient();
  const prisma = {
    socialAccount: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    },
    socialCredential: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      deleteMany: jest.fn().mockResolvedValue(undefined),
    },
    $transaction: jest.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
  } as unknown as PrismaService;
  let service: TikTokTokenService;

  beforeEach(() => {
    client.refreshed = {
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      openId: 'open-id',
      scopes: ['user.info.basic', 'user.info.stats', 'video.list'],
      expiresAt: new Date(Date.now() + 7_200_000),
      refreshExpiresAt: new Date(Date.now() + 15_552_000_000),
    };
    client.refreshError = null;
    client.refreshCalls = 0;
    jest.clearAllMocks();
    prisma.socialAccount.findUnique = jest.fn().mockResolvedValue({
      id: accountId,
      platform: 'TIKTOK',
      platformAccountId: 'open-id',
      status: 'ACTIVE',
      credential: {
        accessTokenEnc: cipher.encrypt('old-access', credentialAad(accountId, 'access')),
        refreshTokenEnc: cipher.encrypt('old-refresh', credentialAad(accountId, 'refresh')),
        expiresAt: new Date(0),
      },
    });
    prisma.socialCredential.findUnique = jest.fn().mockResolvedValue({
      accessTokenEnc: cipher.encrypt('old-access', credentialAad(accountId, 'access')),
      refreshTokenEnc: cipher.encrypt('old-refresh', credentialAad(accountId, 'refresh')),
      expiresAt: new Date(0),
      refreshExpiresAt: new Date(Date.now() + 60_000),
    });
    service = new TikTokTokenService(prisma, cipher, client);
  });

  it('renueva y reemplaza atómicamente el access y el refresh token rotatorio', async () => {
    await expect(service.getAccessToken(accountId)).resolves.toBe('new-access');

    expect(client.refreshCalls).toBe(1);
    const update = jest.mocked(prisma.socialCredential.update).mock.calls[0][0];
    expect(
      cipher.decrypt(update.data.refreshTokenEnc as string, credentialAad(accountId, 'refresh')),
    ).toBe('new-refresh');
    expect(cipher.decrypt(update.data.accessTokenEnc, credentialAad(accountId, 'access'))).toBe(
      'new-access',
    );
    expect(update.data.refreshExpiresAt).toEqual(client.refreshed.refreshExpiresAt);
  });

  it('comparte una única renovación cuando dos sincronizaciones coinciden', async () => {
    await expect(
      Promise.all([service.getAccessToken(accountId), service.getAccessToken(accountId)]),
    ).resolves.toEqual(['new-access', 'new-access']);
    expect(client.refreshCalls).toBe(1);
  });

  it('marca la cuenta revocada si TikTok declara inválido el refresh token', async () => {
    client.refreshError = new TikTokOAuthError('invalid_grant', 'refresh token expirado');

    await expect(service.getAccessToken(accountId)).rejects.toThrow('vuelve a conectar');
    expect(prisma.socialCredential.deleteMany).toHaveBeenCalledWith({
      where: { socialAccountId: accountId },
    });
    expect(prisma.socialAccount.update).toHaveBeenCalledWith({
      where: { id: accountId },
      data: { status: 'REVOKED' },
    });
  });
});
