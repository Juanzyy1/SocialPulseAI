import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { PasswordService } from './password.service';
import { RATE_LIMIT_CONFIG } from './rate-limit.config';
import type { RateLimitConfig } from './rate-limit.config';
import { RateLimiterService } from './rate-limiter.service';
import { SessionMeta, SessionsService } from './sessions.service';
import { CURRENT_TERMS_VERSION, TERMS_OUTDATED_MESSAGE } from '../legal/terms';

/** Código de Prisma para "violación de restricción única". */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}

function tooManyRequests(): HttpException {
  return new HttpException(
    'Demasiados intentos. Inténtalo de nuevo más tarde.',
    HttpStatus.TOO_MANY_REQUESTS,
  );
}

@Injectable()
export class AuthService {
  private dummyHash: Promise<string> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionsService,
    private readonly limiter: RateLimiterService,
    @Inject(RATE_LIMIT_CONFIG) private readonly limits: RateLimitConfig,
  ) {}

  async register(dto: RegisterDto, ip?: string): Promise<UserResponseDto> {
    // El texto que la persona aceptó debe ser el vigente: no se registra la aceptación de otra versión.
    if (dto.termsVersion !== CURRENT_TERMS_VERSION) {
      throw new BadRequestException(TERMS_OUTDATED_MESSAGE);
    }

    // Cada intento de registro cuenta, tenga éxito o no.
    const ipKey = `register:ip:${ip ?? 'unknown'}`;
    if (this.limiter.isBlocked(ipKey, this.limits.registrationsPerIp)) { 
      throw tooManyRequests();
    }
    this.limiter.record(ipKey, this.limits.registrationsPerIp.windowMs);

    const passwordHash = await this.passwords.hash(dto.password);
    try {
      // `select` limita lo que sale de la base: el hash nunca llega a la respuesta.
      return await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          displayName: dto.displayName ?? null,
          termsAcceptedAt: new Date(),
          termsVersion: CURRENT_TERMS_VERSION,
        },
        select: { id: true, email: true, displayName: true, createdAt: true },
      });
    } catch (error) {
      // La restricción única de la base es la defensa real contra duplicados,
      // incluso si dos registros iguales llegan a la vez.
      if (isUniqueViolation(error)) {
        throw new ConflictException('El correo ya está registrado');
      }
      throw error;
    }
  }

  async login(
    dto: LoginDto,
    meta: SessionMeta,
  ): Promise<{ user: UserResponseDto; token: string }> {
    // Las claves guardan un hash del correo, para no acumular correos en memoria.
    const ipKey = `login:ip:${meta.ipAddress ?? 'unknown'}`;
    const emailKey = `login:email:${createHash('sha256').update(dto.email).digest('hex')}`;
    const { loginFailuresPerIp, loginFailuresPerEmail } = this.limits;

    // Se comprueba antes de verificar la clave: un bloqueo vale aunque la clave sea correcta.
    if (
      this.limiter.isBlocked(ipKey, loginFailuresPerIp) ||
      this.limiter.isBlocked(emailKey, loginFailuresPerEmail)
    ) {
      throw tooManyRequests();
    }

    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: {
        id: true,
        email: true,
        displayName: true,
        createdAt: true,
        passwordHash: true,
      },
    });

    // Siempre se ejecuta una verificación Argon2, aunque el usuario no exista,
    // para que el tiempo de respuesta no delate qué correos están registrados.
    const hash = user?.passwordHash ?? (await this.getDummyHash());
    const passwordOk = await this.passwords.verify(hash, dto.password);

    if (!user || !user.passwordHash || !passwordOk) {
      this.limiter.record(ipKey, loginFailuresPerIp.windowMs);
      this.limiter.record(emailKey, loginFailuresPerEmail.windowMs);
      throw new UnauthorizedException('Credenciales inválidas');
    }

    this.limiter.reset(emailKey); // el acceso correcto reinicia el contador del correo
    const { token } = await this.sessions.create(user.id, meta);
    return {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        createdAt: user.createdAt,
      },
      token,
    };
  }

  private getDummyHash(): Promise<string> {
    this.dummyHash ??= this.passwords.hash(randomBytes(16).toString('hex'));
    return this.dummyHash;
  }
}