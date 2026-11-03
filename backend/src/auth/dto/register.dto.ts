import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { TermsAcceptanceDto } from '../../legal/dto/terms-acceptance.dto';

export const normalizeEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class RegisterDto extends TermsAcceptanceDto {
  @ApiProperty({ example: 'ana@example.com' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email: string;

  @ApiProperty({ minLength: 12, maxLength: 128 })
  @IsString()
  @MinLength(12, { message: 'La contraseña debe tener al menos 12 caracteres' })
  @MaxLength(128)
  password: string;

  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string;

  @ApiPropertyOptional({
    maxLength: 64,
    description: 'Código de invitación: obligatorio solo si el registro está cerrado (REGISTRATION_INVITE_CODE)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  inviteCode?: string;
}