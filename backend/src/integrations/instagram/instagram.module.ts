import { Module } from '@nestjs/common';
import { InstagramConnectController } from './instagram-connect.controller';
import { InstagramConnectService } from './instagram-connect.service';
import { InstagramInsightsClient, InstagramInsightsClientImpl } from './instagram-insights.client';
import { InstagramSyncAdapter } from './instagram-sync.adapter';
import { InstagramOAuthClient, InstagramOAuthClientImpl } from './instagram-oauth.client';

@Module({
  controllers: [InstagramConnectController],
  providers: [
    InstagramConnectService,
    InstagramSyncAdapter,
    { provide: InstagramOAuthClient, useClass: InstagramOAuthClientImpl },
    { provide: InstagramInsightsClient, useClass: InstagramInsightsClientImpl },
  ],
  exports: [InstagramSyncAdapter],
})
export class InstagramModule {}
