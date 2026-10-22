import { ApiProperty } from '@nestjs/swagger';
import { SyncRunResponseDto } from './sync-run-response.dto';

export class SyncStatusResponseDto {
  @ApiProperty({
    type: SyncRunResponseDto,
    nullable: true,
    description: 'La última ejecución, o null si la cuenta nunca se ha sincronizado',
  })
  lastRun: SyncRunResponseDto | null;
}