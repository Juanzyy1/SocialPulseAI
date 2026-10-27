import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { TermsAcceptanceDto } from '../legal/dto/terms-acceptance.dto';
import {
  CURRENT_TERMS_VERSION,
  isTermsUpToDate,
  TERMS_OUTDATED_MESSAGE,
} from '../legal/terms';
import { PrismaService } from '../prisma/prisma.service';
import { ProfileResponseDto } from './dto/profile-response.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

// Lista explícita de campos: el hash de la contraseña nunca sale de la base.
const PROFILE_SELECT = {
  id: true,
  email: true,
  displayName: true,
  avatarUrl: true,
  emailVerifiedAt: true,
  createdAt: true,
  termsAcceptedAt: true,
  termsVersion: true,
} as const;

interface ProfileRow {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  emailVerifiedAt: Date | null;
  createdAt: Date;
  termsAcceptedAt: Date | null;
  termsVersion: string | null;
}

function toProfile(user: ProfileRow): ProfileResponseDto {
  return {
    ...user,
    termsUpToDate: isTermsUpToDate(user.termsVersion),
    currentTermsVersion: CURRENT_TERMS_VERSION,
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PROFILE_SELECT,
    });
    if (!user) throw new NotFoundException();
    return toProfile(user);
  }

  /** El `userId` sale siempre de la sesión, nunca de la petición. */
  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileResponseDto> {
    const user = await this.prisma.user.update({
      where: { id: userId },
      // undefined = no tocar el campo; null = borrarlo.
      data: { displayName: dto.displayName, avatarUrl: dto.avatarUrl },
      select: PROFILE_SELECT,
    });
    return toProfile(user);
  }

  /**
   * Registra la aceptación de los términos vigentes. Solo escribe si falta la aceptación de esta
   * versión: repetirlo no cambia la fecha original. El texto aceptado debe ser el vigente.
   */
  async acceptTerms(userId: string, dto: TermsAcceptanceDto): Promise<ProfileResponseDto> {
    if (dto.termsVersion !== CURRENT_TERMS_VERSION) {
      throw new BadRequestException(TERMS_OUTDATED_MESSAGE);
    }
    await this.prisma.user.updateMany({
      where: {
        id: userId,
        // "not" no incluye los NULL en SQL, por eso se pide el caso sin aceptación aparte.
        OR: [{ termsVersion: null }, { termsVersion: { not: CURRENT_TERMS_VERSION } }],
      },
      data: { termsAcceptedAt: new Date(), termsVersion: CURRENT_TERMS_VERSION },
    });
    return this.getProfile(userId);
  }
}