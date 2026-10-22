import { ApiProperty } from '@nestjs/swagger';

export class SyncRunResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ enum: ['RUNNING', 'SUCCEEDED', 'FAILED'] })
  status: string;

  @ApiProperty()
  startedAt: Date;

  @ApiProperty({ type: Date, nullable: true })
  finishedAt: Date | null;

  @ApiProperty({ example: '2026-07-24', description: 'Fecha del Pacífico (AAAA-MM-DD)' })
  rangeStart: string;

  @ApiProperty({ example: '2026-10-21', description: 'Fecha del Pacífico (AAAA-MM-DD)' })
  rangeEnd: string;

  @ApiProperty({ description: 'Filas diarias y totales escritas' })
  rowsWritten: number;

  @ApiProperty({ type: String, nullable: true, description: 'Motivo del fallo, sin secretos' })
  errorMessage: string | null;
}