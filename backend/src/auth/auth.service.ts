import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { PasswordService } from './password.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
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
}