import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AnalyticsAccountDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ['YOUTUBE', 'INSTAGRAM', 'TIKTOK'] })
  platform: string;

  @ApiProperty({ type: String, nullable: true })
  displayName: string | null;

  @ApiProperty({ enum: ['ACTIVE', 'REVOKED', 'ERROR'] })
  status: string;
}

export class PeriodDto {
  @ApiProperty({ enum: ['7d', '30d', '90d', 'custom', 'previous'] })
  kind: string;

  @ApiProperty({ example: '2026-10-13', description: 'Fecha del Pacífico (AAAA-MM-DD)' })
  start: string;

  @ApiProperty({ example: '2026-10-19' })
  end: string;

  @ApiProperty()
  days: number;
}

export class DateRangeDto {
  @ApiProperty({ example: '2026-10-20' })
  from: string;

  @ApiProperty({ example: '2026-10-22' })
  to: string;
}

export class CoverageDto {
  @ApiProperty({ description: 'Días del rango con al menos una métrica guardada' })
  daysWithData: number;

  @ApiProperty({ description: 'Días del rango sin dato. Un día ausente NO es un cero' })
  missingDays: number;

  @ApiProperty({ type: [DateRangeDto] })
  missingRanges: DateRangeDto[];
}

export class MetricValueDto {
  @ApiProperty({ example: 'views' })
  metric: string;

  @ApiProperty({
    enum: ['additive', 'weighted_average'],
    description: 'additive: suma de los días con dato. weighted_average: media ponderada por vistas',
  })
  kind: string;

  @ApiProperty({ enum: ['count', 'minutes', 'seconds'] })
  unit: string;

  @ApiProperty({ type: Number, nullable: true, description: 'null si no se puede calcular (media sin vistas)' })
  value: number | null;

  @ApiProperty({ description: 'Días con dato que intervinieron en el cálculo' })
  daysWithData: number;

  @ApiProperty({ type: String, nullable: true, description: 'Advertencia que debe acompañar al dato' })
  note: string | null;
}

export class TotalValueDto {
  @ApiProperty({ example: 'subscriberCount' })
  metric: string;

  @ApiProperty({ enum: ['count', 'minutes', 'seconds'] })
  unit: string;

  @ApiProperty()
  value: number;

  @ApiProperty({ example: '2026-10-22', description: 'Fecha del Pacífico en que se capturó' })
  capturedOn: string;

  @ApiProperty({ type: String, nullable: true })
  note: string | null;
}

export class DailyPointDto {
  @ApiProperty({ example: '2026-10-18' })
  date: string;

  @ApiProperty({ type: 'object', additionalProperties: { type: 'number' } })
  values: Record<string, number>;
}

export class AccountAnalyticsResponseDto {
  @ApiProperty({ type: AnalyticsAccountDto })
  account: AnalyticsAccountDto;

  @ApiProperty({
    type: PeriodDto,
    nullable: true,
    description: 'null si se pidió un periodo predefinido y la cuenta aún no tiene datos',
  })
  period: PeriodDto | null;

  @ApiProperty({ type: String, nullable: true, description: 'Último día con dato de la cuenta' })
  dataThrough: string | null;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Días entre el último dato y hoy (Pacífico): los datos más recientes aún no existen',
  })
  daysBehind: number | null;

  @ApiProperty({ type: Date, nullable: true })
  lastSyncedAt: Date | null;

  @ApiProperty({ type: CoverageDto, nullable: true })
  coverage: CoverageDto | null;

  @ApiProperty({ type: [MetricValueDto] })
  metrics: MetricValueDto[];

  @ApiProperty({
    type: [TotalValueDto],
    description:
      'Totales más recientes capturados. NO dependen del periodo pedido y no se suman entre días',
  })
  totals: TotalValueDto[];

  @ApiPropertyOptional({ type: [DailyPointDto], description: 'Solo con daily=true; solo días con dato' })
  daily?: DailyPointDto[];

  @ApiProperty({ type: String, nullable: true })
  message: string | null;
}