import { ApiProperty } from '@nestjs/swagger';
import { AnalyticsAccountDto, CoverageDto, PeriodDto } from './account-analytics-response.dto';

export class ComparedValueDto {
  @ApiProperty({ type: Number, nullable: true })
  value: number | null;

  @ApiProperty({ description: 'Días del periodo con dato para esta métrica' })
  daysWithData: number;
}

export class MetricComparisonDto {
  @ApiProperty({ example: 'views' })
  metric: string;

  @ApiProperty({ enum: ['additive', 'weighted_average'] })
  kind: string;

  @ApiProperty({ enum: ['count', 'minutes', 'seconds'] })
  unit: string;

  @ApiProperty({ type: String, nullable: true })
  note: string | null;

  @ApiProperty({ type: ComparedValueDto })
  current: ComparedValueDto;

  @ApiProperty({ type: ComparedValueDto })
  previous: ComparedValueDto;

  @ApiProperty({ description: 'false si los periodos no se pueden comparar con honestidad para esta métrica' })
  comparable: boolean;

  @ApiProperty({ enum: ['MISSING_DATA', 'DIFFERENT_COVERAGE'], nullable: true, type: String })
  reasonCode: string | null;

  @ApiProperty({ type: String, nullable: true })
  reason: string | null;

  @ApiProperty({ type: Number, nullable: true, description: 'actual − anterior; null si no es comparable' })
  change: number | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Cambio relativo en %; null si no es comparable o si el valor anterior es 0',
  })
  changePercent: number | null;
}

export class PeriodSummaryDto {
  @ApiProperty({ type: PeriodDto })
  period: PeriodDto;

  @ApiProperty({ type: CoverageDto })
  coverage: CoverageDto;
}

export class ComparisonResponseDto {
  @ApiProperty({ type: AnalyticsAccountDto })
  account: AnalyticsAccountDto;

  @ApiProperty({ type: String, nullable: true, description: 'Último día con dato de la cuenta' })
  dataThrough: string | null;

  @ApiProperty({ type: Number, nullable: true })
  daysBehind: number | null;

  @ApiProperty({ type: PeriodSummaryDto, nullable: true })
  current: PeriodSummaryDto | null;

  @ApiProperty({
    type: PeriodSummaryDto,
    nullable: true,
    description: 'El periodo inmediatamente anterior, de la misma longitud',
  })
  previous: PeriodSummaryDto | null;

  @ApiProperty({ description: 'true solo si TODAS las métricas se pudieron comparar' })
  comparable: boolean;

  @ApiProperty({ type: String, nullable: true, description: 'Explica en una frase si la comparación está incompleta' })
  message: string | null;

  @ApiProperty({ type: [MetricComparisonDto] })
  metrics: MetricComparisonDto[];
}