import { Module } from '@nestjs/common';
import { InstagramConnectController } from './instagram-connect.controller';
import { InstagramConnectService } from './instagram-connect.service';
import { InstagramOAuthClient, InstagramOAuthClientImpl } from './instagram-oauth.client';

@Module({
  controllers: [InstagramConnectController],
  providers: [
    InstagramConnectService,
    { provide: InstagramOAuthClient, useClass: InstagramOAuthClientImpl },
  ],
})
export class InstagramModule {}
