import { Module } from '@nestjs/common';
import { InstagramModule } from '../integrations/instagram/instagram.module';
import { YoutubeModule } from '../integrations/youtube/youtube.module';
import { InstagramSyncAdapter } from '../integrations/instagram/instagram-sync.adapter';
import { YoutubeSyncAdapter } from '../integrations/youtube/youtube-sync.adapter';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SYNC_ADAPTERS, SyncAdapter } from './sync-adapter';

@Module({
  imports: [YoutubeModule, InstagramModule],
  controllers: [SyncController],
  providers: [
    YoutubeSyncAdapter,
    {
      provide: SYNC_ADAPTERS,
      useFactory: (
        youtube: YoutubeSyncAdapter,
        instagram: InstagramSyncAdapter,
      ): readonly SyncAdapter[] => [youtube, instagram],
      inject: [YoutubeSyncAdapter, InstagramSyncAdapter],
    },
    SyncService,
  ],
})
export class SyncModule {}