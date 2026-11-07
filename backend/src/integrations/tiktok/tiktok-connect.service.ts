import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomBytes, randomUUID } from 'node:crypto';
import { safeEqual } from '../../auth/oauth-flow';
import { credentialAad, TokenCipherService } from '../../common/crypto/token-cipher.service';
import { safeErrorMessage } from '../../common/logging/redact';
import { PrismaService } from '../../prisma/prisma.service';
import { SocialAccountResponseDto } from '../../social-accounts/dto/social-account-response.dto';
import { SOCIAL_ACCOUNT_SELECT } from '../../social-accounts/social-account.select';
import { TikTokOAuthClient, TikTokProfile, TikTokTokens } from './tiktok-oauth.client';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}

@Injectable()
export class TikTokConnectService {
  private readonly logger = new Logger(TikTokConnectService.name);

  constructor(
    private readonly client: TikTokOAuthClient,
    private readonly prisma: PrismaService,
    private readonly cipher: TokenCipherService,
  ) {}

  start(): { url: string; cookieValue: string } {
    this.ensureEnabled();
    const state = randomBytes(32).toString('base64url');
    return { url: this.client.buildAuthUrl(state), cookieValue: state };
  }

  async finish(
    userId: string,
    input: { code: unknown; state: unknown; error: unknown; cookie: unknown },
  ): Promise<SocialAccountResponseDto> {
    this.ensureEnabled();
    if (typeof input.error === 'string') {
      throw new BadRequestException('La autorización con TikTok fue cancelada o rechazada');
    }
    if (
      typeof input.cookie !== 'string' ||
      typeof input.state !== 'string' ||
      typeof input.code !== 'string' ||
      input.code.length === 0 ||
      input.code.length > 2048 ||
      input.state.length > 128 ||
      !safeEqual(input.state, input.cookie)
    ) {
      throw new BadRequestException('Solicitud de conexión inválida');
    }

    let tokens: TikTokTokens;
    try {
      tokens = await this.client.exchangeCode(input.code);
    } catch (error) {
      this.logFailure('el intercambio del código', error);
      throw new BadGatewayException('No se pudo completar la conexión con TikTok');
    }
    const missing = ['user.info.basic', 'user.info.stats', 'video.list'].filter(
      (scope) => !tokens.scopes.includes(scope),
    );
    if (missing.length > 0) {
      throw new BadRequestException(`Faltan permisos obligatorios: ${missing.join(', ')}`);
    }

    let profile: TikTokProfile;
    try {
      profile = await this.client.fetchProfile(tokens.accessToken);
    } catch (error) {
      this.logFailure('la consulta del perfil', error);
      throw new BadGatewayException('No se pudo consultar el perfil de TikTok');
    }
    if (profile.openId !== tokens.openId) {
      throw new BadRequestException('TikTok devolvió una identidad distinta a la autorizada');
    }

    try {
      return await this.persist(userId, profile, tokens);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Esta cuenta de TikTok ya está conectada a otro usuario');
      }
      throw error;
    }
  }

  private ensureEnabled(): void {
    if (!this.client.enabled) {
      throw new ServiceUnavailableException('La conexión con TikTok no está configurada');
    }
  }

  private persist(
    userId: string,
    profile: TikTokProfile,
    tokens: TikTokTokens,
  ): Promise<SocialAccountResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.socialAccount.findUnique({
        where: {
          platform_platformAccountId: {
            platform: 'TIKTOK',
            platformAccountId: profile.openId,
          },
        },
        select: { id: true, userId: true },
      });
      if (existing && existing.userId !== userId) {
        throw new ConflictException('Esta cuenta de TikTok ya está conectada a otro usuario');
      }

      const id = existing?.id ?? randomUUID();
      const credential = {
        accessTokenEnc: this.cipher.encrypt(tokens.accessToken, credentialAad(id, 'access')),
        refreshTokenEnc: this.cipher.encrypt(tokens.refreshToken, credentialAad(id, 'refresh')),
        expiresAt: tokens.expiresAt,
        refreshExpiresAt: tokens.refreshExpiresAt,
        scopes: tokens.scopes,
        keyVersion: this.cipher.keyVersion,
      };
      const account = {
        displayName: profile.displayName,
        handle: null,
        avatarUrl: profile.avatarUrl,
        status: 'ACTIVE' as const,
      };
      return existing
        ? tx.socialAccount.update({
            where: { id },
            data: {
              ...account,
              credential: { upsert: { create: credential, update: credential } },
            },
            select: SOCIAL_ACCOUNT_SELECT,
          })
        : tx.socialAccount.create({
            data: {
              id,
              userId,
              platform: 'TIKTOK',
              platformAccountId: profile.openId,
              ...account,
              credential: { create: credential },
            },
            select: SOCIAL_ACCOUNT_SELECT,
          });
    });
  }

  private logFailure(step: string, error: unknown): void {
    this.logger.warn(`Falló ${step}: ${safeErrorMessage(error)}`);
  }
}
