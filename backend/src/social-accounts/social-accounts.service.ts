import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  credentialAad,
  TokenCipherService,
} from '../common/crypto/token-cipher.service';
import { YoutubeOAuthClient } from '../integrations/youtube/youtube-oauth.client';
import { YoutubeTokenService } from '../integrations/youtube/youtube-token.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectionCheckResponseDto } from './dto/connection-check-response.dto';
import { DisconnectResponseDto } from './dto/disconnect-response.dto';
import { SocialAccountResponseDto } from './dto/social-account-response.dto';
import { SOCIAL_ACCOUNT_SELECT } from './social-account.select';
import { safeErrorMessage } from '../common/logging/redact';

const NOT_FOUND = 'Cuenta no encontrada';

@Injectable()
export class SocialAccountsService {
  private readonly logger = new Logger(SocialAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: TokenCipherService,
    private readonly youtube: YoutubeOAuthClient,
    private readonly youtubeTokens: YoutubeTokenService,
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
   * Comprueba que el acceso a YouTube sigue funcionando. Renueva el token si hace falta
   * y no devuelve métricas: solo informa si cada API responde.
   */
  async checkConnection(userId: string, id: string): Promise<ConnectionCheckResponseDto> {
    const account = await this.prisma.socialAccount.findFirst({
      where: { id, userId },
      select: { id: true, platform: true },
    });
    if (!account) throw new NotFoundException(NOT_FOUND);
    if (account.platform !== 'YOUTUBE') {
      throw new BadRequestException('Esta plataforma todavía no es compatible');
    }

    let accessToken: string;
    try {
      accessToken = await this.youtubeTokens.getAccessToken(id);
    } catch (error) {
      // 409: la conexión ya no es válida y hay que reconectar. Se informa, no es un fallo.
      if (error instanceof ConflictException) {
        return {
          status: 'REVOKED',
          dataApiAccess: false,
          analyticsAccess: false,
          analyticsStatusCode: null,
          message: error.message,
        };
      }
      throw error;
    }

    let dataApiAccess = false;
    try {
      dataApiAccess = (await this.youtube.fetchChannel(accessToken)) !== null;
    } catch (error) {
      this.logFailure('la consulta del canal', error);
    }

    let analyticsAccess = false;
    let analyticsStatusCode: number | null = null;
    try {
      const result = await this.youtube.checkAnalyticsAccess(accessToken);
      analyticsAccess = result.ok;
      analyticsStatusCode = result.statusCode;
    } catch (error) {
      this.logFailure('la consulta a YouTube Analytics', error);
    }

    let message = 'Conexión correcta';
    if (!dataApiAccess || !analyticsAccess) {
      message =
        analyticsStatusCode === 403
          ? 'YouTube Analytics respondió 403: comprueba que la API está habilitada en tu proyecto de Google Cloud y que se concedieron los permisos'
          : 'La conexión tiene problemas; revisa dataApiAccess y analyticsAccess';
    }

    return {
      status: 'ACTIVE',
      dataApiAccess,
      analyticsAccess,
      analyticsStatusCode,
      message,
    };
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
      this.logFailure('la revocación del acceso en Google', error);
      return false;
    }
  }

  /** Solo el mensaje del error: nunca el token. */
  private logFailure(step: string, error: unknown): void {
    this.logger.warn(
      `Falló ${step}: , ${safeErrorMessage(error)}`,
    );
  }
}