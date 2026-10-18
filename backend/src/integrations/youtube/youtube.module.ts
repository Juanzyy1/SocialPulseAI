import { Module } from '@nestjs/common';
import { YoutubeConnectController } from './youtube-connect.controller';
import { YoutubeConnectService } from './youtube-connect.service';
import { YoutubeOAuthClient, YoutubeOAuthClientImpl } from './youtube-oauth.client';

@Module({
  controllers: [YoutubeConnectController],
  providers: [
    YoutubeConnectService,
    { provide: YoutubeOAuthClient, useClass: YoutubeOAuthClientImpl },
  ],
  // Lo usa SocialAccountsModule para revocar el acceso al desconectar.
  exports: [YoutubeOAuthClient],
})
export class YoutubeModule {}