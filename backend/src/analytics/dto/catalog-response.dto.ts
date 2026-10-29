import { ApiProperty } from '@nestjs/swagger';

export class CatalogMetricDto {
  @ApiProperty({ example: 'views' })
  code: string;

  @ApiProperty({ example: 'Vistas', description: 'Nombre para mostrar, en español' })
  label: string;

  @ApiProperty({
    enum: ['additive', 'weighted_average', 'snapshot'],
    description:
      'additive: se suma entre días. weighted_average: media ponderada por otra métrica. snapshot: total puntual, no se agrega',
  })
  kind: string;

  @ApiProperty({ enum: ['count', 'minutes', 'seconds'] })
  unit: string;

  @ApiProperty({
    enum: ['higher_is_better', 'lower_is_better', 'neutral'],
    description:
      'Qué dirección de cambio es buena para quien consulta; sirve para colorear variaciones, no es un juicio sobre el canal',
  })
  polarity: string;

  @ApiProperty({ type: String, nullable: true, description: 'Advertencia que debe acompañar al dato' })
  note: string | null;
}

export class PlatformCatalogDto {
  @ApiProperty({ enum: ['YOUTUBE', 'INSTAGRAM', 'TIKTOK'] })
  platform: string;

  @ApiProperty({ type: [CatalogMetricDto] })
  metrics: CatalogMetricDto[];
}

export class CatalogResponseDto {
  @ApiProperty({ type: [PlatformCatalogDto], description: 'Solo las plataformas que tienen métricas definidas' })
  platforms: PlatformCatalogDto[];
}