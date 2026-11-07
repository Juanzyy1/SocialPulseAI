import { Injectable, Logger } from '@nestjs/common';
import { credentialAad, TokenCipherService } from '../../common/crypto/token-cipher.service';
import { safeErrorMessage } from '../../common/logging/redact';
import { PrismaService } from '../../prisma/prisma.service';
import { SyncDataError } from '../../sync/sync-adapter';
import {
  TIKTOK_SCOPES,
  TikTokOAuthClient,
  TikTokOAuthError,
  TikTokTokens,
} from './tiktok-oauth.client';

const REFRESH_MARGIN_MS = 60_000;

@Injectable()
export class TikTokTokenService {
  private readonly logger = new Logger(TikTokTokenService.name);
  private readonly refreshes = new Map<string, Promise<string>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: TokenCipherService,
    private readonly client: TikTokOAuthClient,
  ) {}

  async getAccessToken(accountId: string): Promise<string> {
    const account = await this.prisma.socialAccount.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        platform: true,
        platformAccountId: true,
        status: true,
        credential: {
          select: { accessTokenEnc: true, refreshTokenEnc: true, expiresAt: true },
        },
      },
    });
    if (!account || account.platform !== 'TIKTOK') {
      throw new SyncDataError('No se encontró la cuenta de TikTok');
    }
    if (account.status === 'REVOKED' || !account.credential) {
      throw new SyncDataError('El acceso de TikTok caducó o fue revocado; vuelve a conectar la cuenta');
    }
    if (
      account.credential.expiresAt &&
      account.credential.expiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS
    ) {
      return this.decryptAccessToken(account.id, account.credential.accessTokenEnc);
    }

    const current = this.refreshes.get(accountId);
    if (current) return current;
    const refresh = this.refresh(account.id, account.platformAccountId);
    this.refreshes.set(accountId, refresh);
    try {
      return await refresh;
    } finally {
      if (this.refreshes.get(accountId) === refresh) this.refreshes.delete(accountId);
    }
  }

  private async refresh(accountId: string, openId: string): Promise<string> {
    const credential = await this.prisma.socialCredential.findUnique({
      where: { socialAccountId: accountId },
      select: {
        accessTokenEnc: true,
        refreshTokenEnc: true,
        expiresAt: true,
        refreshExpiresAt: true,
      },
    });
    if (!credential) {
      throw new SyncDataError('El acceso de TikTok caducó o fue revocado; vuelve a conectar la cuenta');
    }
    if (credential.expiresAt && credential.expiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS) {
      return this.decryptAccessToken(accountId, credential.accessTokenEnc);
    }
    if (
      !credential.refreshTokenEnc ||
      (credential.refreshExpiresAt && credential.refreshExpiresAt <= new Date())
    ) {
      await this.markRevoked(accountId);
      throw new SyncDataError('El acceso de TikTok caducó; vuelve a conectar la cuenta');
    }

    let refreshToken: string;
    try {
      refreshToken = this.cipher.decrypt(
        credential.refreshTokenEnc,
        credentialAad(accountId, 'refresh'),
      );
    } catch {
      throw new SyncDataError('No se pudo leer el acceso de TikTok; vuelve a conectar la cuenta');
    }

    let tokens: TikTokTokens;
    try {
      tokens = await this.client.refreshToken(refreshToken);
    } catch (error) {
      if (error instanceof TikTokOAuthError && error.code === 'invalid_grant') {
        await this.markRevoked(accountId);
        throw new SyncDataError('El acceso de TikTok caducó; vuelve a conectar la cuenta');
      }
      this.logger.warn(`Falló la renovación del token de TikTok: ${safeErrorMessage(error)}`);
      throw error;
    }
    if (tokens.openId !== openId) {
      throw new SyncDataError('TikTok devolvió una identidad distinta a la cuenta conectada');
    }
    if (TIKTOK_SCOPES.some((scope) => !tokens.scopes.includes(scope))) {
      await this.markRevoked(accountId);
      throw new SyncDataError('TikTok ya no concedió todos los permisos; vuelve a conectar la cuenta');
    }

    await this.storeTokens(accountId, tokens);
    return tokens.accessToken;
  }

  private decryptAccessToken(accountId: string, encrypted: string): string {
    try {
      return this.cipher.decrypt(encrypted, credentialAad(accountId, 'access'));
    } catch {
      throw new SyncDataError('No se pudo leer el acceso de TikTok; vuelve a conectar la cuenta');
    }
  }

  private async storeTokens(accountId: string, tokens: TikTokTokens): Promise<void> {
    await this.prisma.socialCredential.update({
      where: { socialAccountId: accountId },
      data: {
        accessTokenEnc: this.cipher.encrypt(tokens.accessToken, credentialAad(accountId, 'access')),
        refreshTokenEnc: this.cipher.encrypt(tokens.refreshToken, credentialAad(accountId, 'refresh')),
        expiresAt: tokens.expiresAt,
        refreshExpiresAt: tokens.refreshExpiresAt,
        scopes: tokens.scopes,
        keyVersion: this.cipher.keyVersion,
      },
    });
  }

  private async markRevoked(accountId: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.socialCredential.deleteMany({ where: { socialAccountId: accountId } }),
      this.prisma.socialAccount.update({
        where: { id: accountId },
        data: { status: 'REVOKED' },
      }),
    ]);
  }
}
