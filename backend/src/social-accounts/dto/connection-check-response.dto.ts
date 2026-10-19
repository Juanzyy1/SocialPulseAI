import { ApiProperty } from '@nestjs/swagger';

export class ConnectionCheckResponseDto {
  @ApiProperty({ enum: ['ACTIVE', 'REVOKED'] })
  status: string;

  @ApiProperty({ description: 'Si se pudo leer el canal con la YouTube Data API' })
  dataApiAccess: boolean;

  @ApiProperty({ description: 'Si respondió la YouTube Analytics API' })
  analyticsAccess: boolean;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: 'Código HTTP de la consulta a Analytics; null si no se llegó a hacer',
  })
  analyticsStatusCode: number | null;

  @ApiProperty()
  message: string;
}