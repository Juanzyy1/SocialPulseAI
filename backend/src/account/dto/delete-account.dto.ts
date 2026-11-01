import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { normalizeEmail } from '../../auth/dto/register.dto';

export class DeleteAccountDto {
  @ApiProperty({
    example: 'ana@example.com',
    description: 'El correo de la cuenta, escrito de nuevo para confirmar (sin distinguir mayúsculas)',
  })
  @Transform(normalizeEmail)
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  confirmEmail: string;

  @ApiPropertyOptional({
    maxLength: 128,
    description: 'Obligatoria si la cuenta tiene contraseña (`hasPassword` del perfil)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  password?: string;
}