import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class ProbeQueryDto {
  @ApiPropertyOptional({
    minimum: 1,
    maximum: 90,
    default: 30,
    description: 'Días a consultar, de 1 a 90',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'days debe ser un entero' })
  @Min(1)
  @Max(90)
  days?: number;
}