import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { PasswordService } from './password.service';
import { SessionMeta, SessionsService } from './sessions.service';

/** Código de Prisma para "violación de restricción única". */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 'P2002'
  );
}

@Injectable()
export class AuthService {
  private dummyHash: Promise<string> | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionsService,
  ) {}

  async register(dto: RegisterDto): Promise<UserResponseDto> {
    const passwordHash = await this.passwords.hash(dto.password);
    try {
      // `select` limita lo que sale de la base: el hash nunca llega a la respuesta.
      return await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash,
          displayName: dto.displayName ?? null,
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
      throw new UnauthorizedException('Credenciales inválidas');
    }

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