import {
  BadGatewayException,
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  createOAuthTransaction,
  packOAuthCookie,
  safeEqual,
  unpackOAuthCookie,
} from '../../auth/oauth-flow';
import {
  credentialAad,
  TokenCipherService,
} from '../../common/crypto/token-cipher.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SocialAccountResponseDto } from '../../social-accounts/dto/social-account-response.dto';
import {
  YOUTUBE_SCOPES,
  YoutubeChannel,
  YoutubeOAuthClient,
  YoutubeTokens,
} from './youtube-oauth.client';

import { SOCIAL_ACCOUNT_SELECT as ACCOUNT_SELECT } from '../../social-accounts/social-account.select';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}

@Injectable()
export class YoutubeConnectService {
  private readonly logger = new Logger(YoutubeConnectService.name);

  constructor(
    private readonly client: YoutubeOAuthClient,
    private readonly prisma: PrismaService,
    private readonly cipher: TokenCipherService,
  ) {}

  private ensureEnabled(): void {
    if (!this.client.enabled) {
      throw new ServiceUnavailableException(
        'La conexión con YouTube no está configurada',
      );
    }
  }

  /** Paso 1: genera state y PKCE, y la URL a la que se redirige al usuario. */
  start(): { url: string; cookieValue: string } {
    this.ensureEnabled();
    // La transacción incluye un nonce que aquí no se usa (no pedimos id_token).
    const transaction = createOAuthTransaction();
    return {
      url: this.client.buildAuthUrl(transaction),
      cookieValue: packOAuthCookie(transaction),
    };
  }

  /** Paso 2: valida la respuesta de Google y guarda la cuenta con credenciales cifradas. */
  async finish(
    userId: string,
    input: { code: unknown; state: unknown; error: unknown; cookie: unknown },
  ): Promise<SocialAccountResponseDto> {
    this.ensureEnabled();

    if (typeof input.error === 'string') {
      throw new BadRequestException(
        'La autorización con Google fue cancelada o rechazada',
      );
    }

    const saved =
      typeof input.cookie === 'string' ? unpackOAuthCookie(input.cookie) : null;
    if (
      !saved ||
      typeof input.state !== 'string' ||
      typeof input.code !== 'string' ||
      input.code.length === 0 ||
      input.code.length > 2048 ||
      !safeEqual(input.state, saved.state)
    ) {
      throw new BadRequestException('Solicitud de conexión inválida');
    }

    let tokens: YoutubeTokens;
    try {
      tokens = await this.client.exchangeCode(input.code, saved.codeVerifier);
    } catch (error) {
      this.logFailure('el intercambio del código', error);
      throw new BadGatewayException('No se pudo completar la conexión con Google');
    }

    // El usuario puede desmarcar permisos en la pantalla de consentimiento.
    const missing = YOUTUBE_SCOPES.filter((s) => !tokens.scopes.includes(s));
    if (missing.length > 0) {
      throw new BadRequestException(
        `Faltan permisos obligatorios: ${missing.join(', ')}`,
      );
    }
    const refreshToken = tokens.refreshToken;
    if (!refreshToken) {
      throw new BadRequestException(
        'Google no entregó un token de actualización; vuelve a conectar la cuenta',
      );
    }

    let channel: YoutubeChannel | null;
    try {
      channel = await this.client.fetchChannel(tokens.accessToken);
    } catch (error) {
      this.logFailure('la consulta del canal', error);
      throw new BadGatewayException('No se pudo consultar el canal en YouTube');
    }
    if (!channel) {
      throw new BadRequestException(
        'La cuenta de Google no tiene un canal de YouTube',
      );
    }

    try {
      return await this.persist(userId, channel, {
        accessToken: tokens.accessToken,
        refreshToken,
        expiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Este canal ya está conectado a otra cuenta');
      }
      throw error;
    }
  }

  private persist(
    userId: string,
    channel: YoutubeChannel,
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiresAt?: Date;
      scopes: string[];
    },
  ): Promise<SocialAccountResponseDto> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.socialAccount.findUnique({
        where: {
          platform_platformAccountId: {
            platform: 'YOUTUBE',
            platformAccountId: channel.channelId,
          },
        },
        select: { id: true, userId: true },
      });
      // Un canal solo puede estar conectado por un usuario (regla 6).
      if (existing && existing.userId !== userId) {
        throw new ConflictException('Este canal ya está conectado a otra cuenta');
      }

      // El id se fija antes de cifrar: los datos asociados ligan cada token a su fila.
      const id = existing?.id ?? randomUUID();
      const credential = {
        accessTokenEnc: this.cipher.encrypt(tokens.accessToken, credentialAad(id, 'access')),
        refreshTokenEnc: this.cipher.encrypt(tokens.refreshToken, credentialAad(id, 'refresh')),
        expiresAt: tokens.expiresAt ?? null,
        scopes: tokens.scopes,
        keyVersion: this.cipher.keyVersion,
      };
      const profile = {
        displayName: channel.title,
        handle: channel.handle,
        avatarUrl: channel.avatarUrl,
        status: 'ACTIVE' as const,
      };

      if (existing) {
        return tx.socialAccount.update({
          where: { id },
          data: {
            ...profile,
            credential: { upsert: { create: credential, update: credential } },
          },
          select: ACCOUNT_SELECT,
        });
      }
      return tx.socialAccount.create({
        data: {
          id,
          userId,
          platform: 'YOUTUBE',
          platformAccountId: channel.channelId,
          ...profile,
          credential: { create: credential },
        },
        select: ACCOUNT_SELECT,
      });
    });
  }

  /** Se registra solo el mensaje del error: nunca códigos ni tokens. */
  private logFailure(step: string, error: unknown): void {
    this.logger.warn(
      `Falló ${step}: ${error instanceof Error ? error.message : 'error desconocido'}`,
    );
  }
}