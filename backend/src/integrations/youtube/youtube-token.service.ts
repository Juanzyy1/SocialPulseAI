import {
  BadGatewayException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  credentialAad,
  TokenCipherService,
} from '../../common/crypto/token-cipher.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RefreshedToken,
  RefreshTokenRevokedError,
  YoutubeOAuthClient,
} from './youtube-oauth.client';
import { safeErrorMessage } from '../../common/logging/redact';

// Se renueva el token si le quedan menos de 60 segundos de vida.
const REFRESH_MARGIN_MS = 60_000;
const RECONNECT_MESSAGE =
  'El acceso a YouTube fue revocado o caducó; vuelve a conectar la cuenta';

@Injectable()
export class YoutubeTokenService {
  private readonly logger = new Logger(YoutubeTokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: TokenCipherService,
    private readonly client: YoutubeOAuthClient,
  ) {}

  /**
   * Devuelve un access token vigente, renovándolo si hace falta.
   * Lanza 409 si la conexión ya no es válida y hay que reconectar.
   * Quien lo llame debe haber comprobado antes que la cuenta es del usuario.
   */
  async getAccessToken(accountId: string): Promise<string> {
    const account = await this.prisma.socialAccount.findUnique({
      where: { id: accountId },
      select: {
        id: true,
        status: true,
        credential: {
          select: { accessTokenEnc: true, refreshTokenEnc: true, expiresAt: true },
        },
      },
    });
    if (!account) throw new NotFoundException('Cuenta no encontrada');

    const credential = account.credential;
    if (account.status === 'REVOKED' || !credential) {
      throw new ConflictException(RECONNECT_MESSAGE);
    }

    const accessToken = this.cipher.decrypt(
      credential.accessTokenEnc,
      credentialAad(account.id, 'access'),
    );
    if (
      credential.expiresAt &&
      credential.expiresAt.getTime() - Date.now() > REFRESH_MARGIN_MS
    ) {
      return accessToken;
    }

    if (!credential.refreshTokenEnc) {
      await this.markRevoked(account.id);
      throw new ConflictException(RECONNECT_MESSAGE);
    }
    const refreshToken = this.cipher.decrypt(
      credential.refreshTokenEnc,
      credentialAad(account.id, 'refresh'),
    );

    let refreshed: RefreshedToken;
    try {
      refreshed = await this.client.refreshAccessToken(refreshToken);
    } catch (error) {
      if (error instanceof RefreshTokenRevokedError) {
        await this.markRevoked(account.id);
        throw new ConflictException(RECONNECT_MESSAGE);
      }
      // Un fallo transitorio (red, 5xx) NO revoca la cuenta. Solo se registra el mensaje.
      this.logger.warn(
        `Falló la renovación del token: ${safeErrorMessage(error)}`,
      );
      throw new BadGatewayException('No se pudo renovar el acceso con Google');
    }

    await this.prisma.socialCredential.update({
      where: { socialAccountId: account.id },
      data: {
        accessTokenEnc: this.cipher.encrypt(
          refreshed.accessToken,
          credentialAad(account.id, 'access'),
        ),
        expiresAt: refreshed.expiresAt ?? null,
        keyVersion: this.cipher.keyVersion,
      },
    });
    return refreshed.accessToken;
  }

  /** Marca la cuenta como revocada y borra sus credenciales: no se guardan secretos inservibles. */
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