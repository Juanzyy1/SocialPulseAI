import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional, IsUUID, Matches } from 'class-validator';

/** Convierte "true"/"false" de la URL en booleanos; cualquier otro texto lo rechaza la validación. */
const toBoolean = ({ value }: { value: unknown }) =>
  value === 'true' ? true : value === 'false' ? false : value;

/** Parámetros de periodo comunes a todas las consultas de estadísticas. */
export class PeriodParamsDto {
  @ApiPropertyOptional({
    enum: ['7d', '30d', '90d'],
    description:
      'Periodo predefinido: termina en el último día con dato de la cuenta. No se combina con from/to. Por defecto, 30d',
  })
  @IsOptional()
  @IsIn(['7d', '30d', '90d'], { message: 'period debe ser 7d, 30d o 90d' })
  period?: string;

  @ApiPropertyOptional({
    example: '2026-09-20',
    description: 'Inicio de un rango personalizado (fecha del Pacífico). Requiere `to`',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'from debe tener formato AAAA-MM-DD' })
  from?: string;

  @ApiPropertyOptional({
    example: '2026-10-19',
    description: 'Fin del rango (no posterior a hoy, máximo 366 días). Requiere `from`',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'to debe tener formato AAAA-MM-DD' })
  to?: string;
}

export class PeriodQueryDto extends PeriodParamsDto {
  @ApiPropertyOptional({ default: false, description: 'Incluye la serie diaria' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean({ message: 'daily debe ser true o false' })
  daily?: boolean;
}

export class CompareQueryDto extends PeriodParamsDto {
  @ApiProperty({ format: 'uuid', description: 'Cuenta social a comparar' })
  @IsUUID('all', { message: 'accountId debe ser un UUID' })
  accountId: string;
}