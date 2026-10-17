import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

/** Recorta espacios; un texto vacío pasa a null (borra el campo). */
const trimOrNull = ({ value }: { value: unknown }) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

/**
 * Solo estos campos se pueden editar. Cualquier otro (id, email, passwordHash,
 * emailVerifiedAt...) provoca un 400 gracias a `forbidNonWhitelisted`.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 80 })
  @Transform(trimOrNull)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  displayName?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: 2048,
    description: 'URL https de la imagen de perfil',
  })
  @Transform(trimOrNull)
  @IsOptional()
  @IsUrl(
    { protocols: ['https'], require_protocol: true },
    { message: 'avatarUrl debe ser una URL https válida' },
  )
  @MaxLength(2048)
  avatarUrl?: string | null;
}