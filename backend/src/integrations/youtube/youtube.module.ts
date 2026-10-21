import { Module } from '@nestjs/common';
import { YoutubeAnalyticsClient, YoutubeAnalyticsClientImpl } from './youtube-analytics.client';
import { YoutubeConnectController } from './youtube-connect.controller';
import { YoutubeConnectService } from './youtube-connect.service';
import { YoutubeOAuthClient, YoutubeOAuthClientImpl } from './youtube-oauth.client';
import { YoutubeTokenService } from './youtube-token.service';

@Module({
  controllers: [YoutubeConnectController],
  providers: [
    YoutubeConnectService,
    YoutubeTokenService,
    { provide: YoutubeOAuthClient, useClass: YoutubeOAuthClientImpl },
    { provide: YoutubeAnalyticsClient, useClass: YoutubeAnalyticsClientImpl },
  ],
  // Los usan SocialAccountsModule y AnalyticsModule.
  exports: [YoutubeOAuthClient, YoutubeTokenService, YoutubeAnalyticsClient],
})
export class YoutubeModule {}