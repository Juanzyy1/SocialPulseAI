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
import {
  InstagramOAuthClient,
  InstagramProfile,
  InstagramTokens,
} from './instagram-oauth.client';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}

@Injectable()
export class InstagramConnectService {
  private readonly logger = new Logger(InstagramConnectService.name);

  constructor(
    private readonly client: InstagramOAuthClient,
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
  ): Promise<SocialAccountResponseDto[]> {
    this.ensureEnabled();
    if (typeof input.error === 'string') {
      throw new BadRequestException('La autorización con Instagram fue cancelada o rechazada');
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

    let tokens: InstagramTokens;
    try {
      tokens = await this.client.exchangeCode(input.code);
    } catch (error) {
      this.logFailure('el intercambio del código', error);
      throw new BadGatewayException('No se pudo completar la conexión con Instagram');
    }

    let profiles: InstagramProfile[];
    try {
      profiles = await this.client.fetchProfiles(tokens.accessToken);
    } catch (error) {
      this.logFailure('la consulta de cuentas', error);
      throw new BadGatewayException('No se pudieron consultar las cuentas de Instagram');
    }
    if (profiles.length === 0) {
      throw new BadRequestException('No se compartió ninguna cuenta profesional de Instagram');
    }

    try {
      return await this.persist(userId, profiles, tokens);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Esta cuenta de Instagram ya está conectada a otro usuario');
      }
      throw error;
    }
  }

  private ensureEnabled(): void {
    if (!this.client.enabled) {
      throw new ServiceUnavailableException('La conexión con Instagram no está configurada');
    }
  }

  private persist(
    userId: string,
    profiles: InstagramProfile[],
    tokens: InstagramTokens,
  ): Promise<SocialAccountResponseDto[]> {
    return this.prisma.$transaction(async (tx) => {
      const saved: SocialAccountResponseDto[] = [];
      for (const profile of profiles) {
        const existing = await tx.socialAccount.findUnique({
          where: {
            platform_platformAccountId: {
              platform: 'INSTAGRAM',
              platformAccountId: profile.accountId,
            },
          },
          select: { id: true, userId: true },
        });
        if (existing && existing.userId !== userId) {
          throw new ConflictException('Esta cuenta de Instagram ya está conectada a otro usuario');
        }

        const id = existing?.id ?? randomUUID();
        const credential = {
          accessTokenEnc: this.cipher.encrypt(tokens.accessToken, credentialAad(id, 'access')),
          refreshTokenEnc: null,
          expiresAt: tokens.expiresAt,
          scopes: ['instagram_basic', 'instagram_manage_insights'],
          keyVersion: this.cipher.keyVersion,
        };
        const account = {
          displayName: profile.username,
          handle: profile.username,
          avatarUrl: null,
          status: 'ACTIVE' as const,
        };

        const result = existing
          ? await tx.socialAccount.update({
              where: { id },
              data: {
                ...account,
                credential: { upsert: { create: credential, update: credential } },
              },
              select: SOCIAL_ACCOUNT_SELECT,
            })
          : await tx.socialAccount.create({
              data: {
                id,
                userId,
                platform: 'INSTAGRAM',
                platformAccountId: profile.accountId,
                ...account,
                credential: { create: credential },
              },
              select: SOCIAL_ACCOUNT_SELECT,
            });
        saved.push(result);
      }
      return saved;
    });
  }

  private logFailure(step: string, error: unknown): void {
    this.logger.warn(`Falló ${step}: ${safeErrorMessage(error)}`);
  }
}
