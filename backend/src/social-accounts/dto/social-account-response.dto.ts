import { ApiProperty } from '@nestjs/swagger';

/** Datos públicos de una cuenta social. Nunca incluye credenciales ni tokens. */
export class SocialAccountResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ['YOUTUBE', 'INSTAGRAM', 'TIKTOK'] })
  platform: string;

  @ApiProperty({ description: 'En YouTube, el ID del canal' })
  platformAccountId: string;

  @ApiProperty({ type: String, nullable: true })
  displayName: string | null;

  @ApiProperty({ type: String, nullable: true, example: '@micanal' })
  handle: string | null;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ enum: ['ACTIVE', 'REVOKED', 'ERROR'] })
  status: string;

  @ApiProperty()
  connectedAt: Date;

  @ApiProperty({ type: Date, nullable: true })
  lastSyncedAt: Date | null;
}