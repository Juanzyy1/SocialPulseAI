import { Module } from '@nestjs/common';
import { TikTokConnectController } from './tiktok-connect.controller';
import { TikTokConnectService } from './tiktok-connect.service';
import { TikTokOAuthClient, TikTokOAuthClientImpl } from './tiktok-oauth.client';
import { TikTokSyncAdapter } from './tiktok-sync.adapter';
import { TikTokTokenService } from './tiktok-token.service';

@Module({
  controllers: [TikTokConnectController],
  providers: [
    TikTokConnectService,
    TikTokTokenService,
    TikTokSyncAdapter,
    { provide: TikTokOAuthClient, useClass: TikTokOAuthClientImpl },
  ],
  exports: [TikTokOAuthClient, TikTokSyncAdapter, TikTokTokenService],
})
export class TikTokModule {}
