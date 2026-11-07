import { Module } from '@nestjs/common';
import { InstagramModule } from '../integrations/instagram/instagram.module';
import { YoutubeModule } from '../integrations/youtube/youtube.module';
import { InstagramSyncAdapter } from '../integrations/instagram/instagram-sync.adapter';
import { YoutubeSyncAdapter } from '../integrations/youtube/youtube-sync.adapter';
import { TikTokModule } from '../integrations/tiktok/tiktok.module';
import { TikTokSyncAdapter } from '../integrations/tiktok/tiktok-sync.adapter';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SYNC_ADAPTERS, SyncAdapter } from './sync-adapter';

@Module({
  imports: [YoutubeModule, InstagramModule, TikTokModule],
  controllers: [SyncController],
  providers: [
    YoutubeSyncAdapter,
    {
      provide: SYNC_ADAPTERS,
      useFactory: (
        youtube: YoutubeSyncAdapter,
        instagram: InstagramSyncAdapter,
        tiktok: TikTokSyncAdapter,
      ): readonly SyncAdapter[] => [youtube, instagram, tiktok],
        inject: [YoutubeSyncAdapter, InstagramSyncAdapter, TikTokSyncAdapter],
    },
    SyncService,
  ],
})
export class SyncModule {}