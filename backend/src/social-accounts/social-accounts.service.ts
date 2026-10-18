import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  credentialAad,
  TokenCipherService,
} from '../common/crypto/token-cipher.service';
import { YoutubeOAuthClient } from '../integrations/youtube/youtube-oauth.client';
import { PrismaService } from '../prisma/prisma.service';
import { DisconnectResponseDto } from './dto/disconnect-response.dto';
import { SocialAccountResponseDto } from './dto/social-account-response.dto';
import { SOCIAL_ACCOUNT_SELECT } from './social-account.select';

const NOT_FOUND = 'Cuenta no encontrada';

@Injectable()
export class SocialAccountsService {
  private readonly logger = new Logger(SocialAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: TokenCipherService,
    private readonly youtube: YoutubeOAuthClient,
  ) {}

  /** Todas las consultas filtran por `userId`, que sale siempre de la sesión. */
  list(userId: string): Promise<SocialAccountResponseDto[]> {
    return this.prisma.socialAccount.findMany({
      where: { userId },
      orderBy: { connectedAt: 'desc' },
      select: SOCIAL_ACCOUNT_SELECT,
    });
  }

  async get(userId: string, id: string): Promise<SocialAccountResponseDto> {
    const account = await this.prisma.socialAccount.findFirst({
      where: { id, userId },
      select: SOCIAL_ACCOUNT_SELECT,
    });
    // Mismo error si no existe o es de otro usuario: no se revela qué IDs existen.
    if (!account) throw new NotFoundException(NOT_FOUND);
    return account;
  }

  async disconnect(userId: string, id: string): Promise<DisconnectResponseDto> {
    const account = await this.prisma.socialAccount.findFirst({
      where: { id, userId },
      select: {
        id: true,
        platform: true,
        credential: {
          select: { accessTokenEnc: true, refreshTokenEnc: true },
        },
      },
    });
    if (!account) throw new NotFoundException(NOT_FOUND);

    const revokedAtGoogle = await this.revokeAtProvider(account);

    // Borrar la cuenta elimina su credencial en cascada. Filtrar por userId otra vez
    // protege ante una condición de carrera.
    const { count } = await this.prisma.socialAccount.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException(NOT_FOUND);

    return { revokedAtGoogle };
  }

  /**
   * Intenta revocar el acceso en la plataforma. Nunca lanza: si falla, la cuenta se
   * desconecta igual y se informa. Cuando haya más plataformas, cada una se añade aquí.
   */
  private async revokeAtProvider(account: {
    id: string;
    platform: string;
    credential: { accessTokenEnc: string; refreshTokenEnc: string | null } | null;
  }): Promise<boolean> {
    if (account.platform !== 'YOUTUBE' || !account.credential) return false;
    try {
      const { refreshTokenEnc, accessTokenEnc } = account.credential;
      // El refresh token sostiene el acceso; revocarlo invalida también los access tokens.
      const token = refreshTokenEnc
        ? this.cipher.decrypt(refreshTokenEnc, credentialAad(account.id, 'refresh'))
        : this.cipher.decrypt(accessTokenEnc, credentialAad(account.id, 'access'));
      await this.youtube.revokeToken(token);
      return true;
    } catch (error) {
      // Solo el mensaje del error: nunca el token.
      this.logger.warn(
        `No se pudo revocar el acceso en Google: ${error instanceof Error ? error.message : 'error desconocido'}`,
      );
      return false;
    }
  }
}