import { Injectable, NotFoundException } from '@nestjs/common';
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
} as const;

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: PROFILE_SELECT,
    });
    if (!user) throw new NotFoundException();
    return user;
  }

  /** El `userId` sale siempre de la sesión, nunca de la petición. */
  updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<ProfileResponseDto> {
    return this.prisma.user.update({
      where: { id: userId },
      // undefined = no tocar el campo; null = borrarlo.
      data: { displayName: dto.displayName, avatarUrl: dto.avatarUrl },
      select: PROFILE_SELECT,
    });
  }
}