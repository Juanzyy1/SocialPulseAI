import { ApiProperty } from '@nestjs/swagger';
import {
  CoverageDto,
  MetricValueDto,
  PeriodDto,
  TotalValueDto,
} from './account-analytics-response.dto';

export class OverviewAccountDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ['YOUTUBE', 'INSTAGRAM', 'TIKTOK'] })
  platform: string;

  @ApiProperty({ type: String, nullable: true })
  displayName: string | null;

  @ApiProperty({ enum: ['ACTIVE', 'REVOKED', 'ERROR'] })
  status: string;

  @ApiProperty({ type: Date, nullable: true })
  lastSyncedAt: Date | null;

  @ApiProperty({ type: String, nullable: true, description: 'Último día con dato de ESTA cuenta' })
  dataThrough: string | null;

  @ApiProperty({ type: Number, nullable: true })
  daysBehind: number | null;

  @ApiProperty({
    type: CoverageDto,
    nullable: true,
    description: 'Cobertura de esta cuenta en el rango común; null si no se pudo fijar un periodo',
  })
  coverage: CoverageDto | null;

  @ApiProperty({ type: [MetricValueDto] })
  metrics: MetricValueDto[];

  @ApiProperty({
    type: [TotalValueDto],
    description: 'Totales más recientes de esta cuenta. Nunca se suman entre cuentas',
  })
  totals: TotalValueDto[];
}

export class CombinedMetricDto {
  @ApiProperty({ example: 'views' })
  metric: string;

  @ApiProperty({ enum: ['additive', 'weighted_average'] })
  kind: string;

  @ApiProperty({ enum: ['count', 'minutes', 'seconds'] })
  unit: string;

  @ApiProperty({ type: Number, nullable: true })
  value: number | null;

  @ApiProperty({ description: 'Cuentas cuyo valor intervino en el cálculo' })
  accountsIncluded: number;

  @ApiProperty({ type: String, nullable: true })
  note: string | null;
}

export class PlatformSummaryDto {
  @ApiProperty({ enum: ['YOUTUBE', 'INSTAGRAM', 'TIKTOK'] })
  platform: string;

  @ApiProperty()
  accountCount: number;

  @ApiProperty({ description: 'Cuentas con al menos un día con dato en el rango' })
  accountsWithData: number;

  @ApiProperty({
    description: 'true solo si TODAS las cuentas tienen dato en todos los días del rango; si no, los totales son parciales',
  })
  complete: boolean;

  @ApiProperty({ type: [CombinedMetricDto] })
  metrics: CombinedMetricDto[];
}

export class CrossPlatformGroupDto {
  @ApiProperty({ description: 'Grupo compatible definido en el catálogo de métricas' })
  group: string;

  @ApiProperty({ enum: ['count', 'minutes', 'seconds'] })
  unit: string;

  @ApiProperty()
  value: number;

  @ApiProperty({ type: [String] })
  platforms: string[];
}

export class CrossPlatformDto {
  @ApiProperty({ type: [CrossPlatformGroupDto] })
  groups: CrossPlatformGroupDto[];

  @ApiProperty({ type: String, nullable: true })
  message: string | null;
}

export class OverviewResponseDto {
  @ApiProperty({
    type: PeriodDto,
    nullable: true,
    description: 'Rango común a todas las cuentas; null si se pidió un periodo predefinido y ninguna cuenta tiene datos',
  })
  period: PeriodDto | null;

  @ApiProperty({ type: String, nullable: true, description: 'Último día con dato entre todas las cuentas' })
  dataThrough: string | null;

  @ApiProperty({ type: Number, nullable: true })
  daysBehind: number | null;

  @ApiProperty({ type: [OverviewAccountDto] })
  accounts: OverviewAccountDto[];

  @ApiProperty({ type: [PlatformSummaryDto] })
  platforms: PlatformSummaryDto[];

  @ApiProperty({ type: CrossPlatformDto })
  crossPlatform: CrossPlatformDto;

  @ApiProperty({ type: String, nullable: true })
  message: string | null;
}