import { ApiProperty } from '@nestjs/swagger';

export class ProfileResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'ana@example.com' })
  email: string;

  @ApiProperty({ type: String, nullable: true })
  displayName: string | null;

  @ApiProperty({ type: String, nullable: true })
  avatarUrl: string | null;

  @ApiProperty({ type: Date, nullable: true, description: 'null si el correo no está verificado' })
  emailVerifiedAt: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty({ type: Date, nullable: true, description: 'Cuándo aceptó los términos; null si nunca' })
  termsAcceptedAt: Date | null;

  @ApiProperty({ type: String, nullable: true, description: 'Versión de los términos que aceptó' })
  termsVersion: string | null;

  @ApiProperty({
    description:
      'false si no aceptó la versión vigente: la interfaz debe pedir la aceptación antes de mostrar el panel',
  })
  termsUpToDate: boolean;

  @ApiProperty({ example: '2026-10-24', description: 'Versión vigente de los términos' })
  currentTermsVersion: string;
}