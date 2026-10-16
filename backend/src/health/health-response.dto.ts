import { ApiProperty } from '@nestjs/swagger';

export class HealthResponseDto {
  @ApiProperty({ example: 'ok' })
  status: string;

  @ApiProperty({ example: '2026-10-16T12:00:00.000Z' })
  timestamp: string;

  @ApiProperty({
    example: 123.4,
    description: 'Segundos desde que arrancó el proceso',
  })
  uptime: number;
}