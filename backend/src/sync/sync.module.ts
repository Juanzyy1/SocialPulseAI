import { Module } from '@nestjs/common';
import { YoutubeModule } from '../integrations/youtube/youtube.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [YoutubeModule],
  controllers: [SyncController],
  providers: [SyncService],
})
export class SyncModule {}