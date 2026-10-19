import { Module } from '@nestjs/common';
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
  ],
  // Los usa SocialAccountsModule para desconectar y comprobar el acceso.
  exports: [YoutubeOAuthClient, YoutubeTokenService],
})
export class YoutubeModule {}