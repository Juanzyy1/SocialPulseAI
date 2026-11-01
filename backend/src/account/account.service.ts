import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PasswordService } from '../auth/password.service';
import { safeErrorMessage } from '../common/logging/redact';
import { PrismaService } from '../prisma/prisma.service';
import { SocialAccountsService } from '../social-accounts/social-accounts.service';
import { AttemptLimiter } from './attempt-limiter';
import { DeleteAccountResponseDto } from './dto/delete-account-response.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';

const MAX_FAILED_CONFIRMATIONS = 5;
const WINDOW_MS = 15 * 60 * 1000;

const CONFIRMATION_FAILED = 'Los datos de confirmación no son correctos';
const TOO_MANY_ATTEMPTS =
  'Demasiados intentos fallidos. Espera unos minutos antes de volver a intentarlo';

@Injectable()
export class AccountService {
  private readonly logger = new Logger(AccountService.name);
  private readonly attempts = new AttemptLimiter(MAX_FAILED_CONFIRMATIONS, WINDOW_MS);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly socialAccounts: SocialAccountsService,
  ) {}

  /**
   * Elimina la cuenta del usuario de la sesión y todos sus datos. Antes desconecta cada canal
   * (revocando el acceso en Google); si eso falla, la cuenta se elimina igualmente y se informa.
   */
  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<DeleteAccountResponseDto> {
    if (this.attempts.isBlocked(userId)) {
      throw new HttpException(TOO_MANY_ATTEMPTS, HttpStatus.TOO_MANY_REQUESTS);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, passwordHash: true },
    });
    if (!user) throw new NotFoundException();

    await this.confirmIdentity(userId, user, dto);

    const accounts = await this.prisma.socialAccount.findMany({
      where: { userId },
      select: { id: true },
    });
    let notConfirmed = 0;
    for (const account of accounts) {
      try {
        const result = await this.socialAccounts.disconnect(userId, account.id);
        if (!result.revokedAtGoogle) notConfirmed += 1;
      } catch (error) {
        notConfirmed += 1;
        this.logger.warn(
          `No se pudo desconectar una cuenta al eliminar a un usuario: ${safeErrorMessage(error)}`,
        );
      }
    }

    // Sesiones, identidades, cuentas, credenciales y estadísticas se borran en cascada.
    // deleteMany (y no delete): si dos peticiones coinciden, la segunda no falla.
    await this.prisma.user.deleteMany({ where: { id: userId } });
    this.attempts.reset(userId);
    this.logger.log('Cuenta de usuario eliminada');

    return { accountsDisconnected: accounts.length, revocationsNotConfirmed: notConfirmed };
  }

  /** Comprueba siempre las dos cosas y da un único error: no se revela cuál de las dos falló. */
  private async confirmIdentity(
    userId: string,
    user: { email: string; passwordHash: string | null },
    dto: DeleteAccountDto,
  ): Promise<void> {
    const emailMatches = dto.confirmEmail.trim().toLowerCase() === user.email.trim().toLowerCase();

    let passwordOk = true;
    if (user.passwordHash !== null) {
      passwordOk = !!dto.password && (await this.passwords.verify(user.passwordHash, dto.password));
    }

    if (emailMatches && passwordOk) return;
    this.attempts.recordFailure(userId);
    throw new ForbiddenException(CONFIRMATION_FAILED);
  }
}