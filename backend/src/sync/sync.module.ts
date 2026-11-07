import { Module } from '@nestjs/common';
import { YoutubeModule } from '../integrations/youtube/youtube.module';
import { YoutubeSyncAdapter } from '../integrations/youtube/youtube-sync.adapter';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SYNC_ADAPTERS, SyncAdapter } from './sync-adapter';

@Module({
  imports: [YoutubeModule],
  controllers: [SyncController],
  providers: [
    YoutubeSyncAdapter,
    {
      provide: SYNC_ADAPTERS,
      useFactory: (youtube: YoutubeSyncAdapter): readonly SyncAdapter[] => [youtube],
      inject: [YoutubeSyncAdapter],
    },
    SyncService,
  ],
})
export class SyncModule {}