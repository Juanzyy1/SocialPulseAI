import { Module } from '@nestjs/common';
import { YoutubeModule } from '../integrations/youtube/youtube.module';
import { TikTokModule } from '../integrations/tiktok/tiktok.module';
import { SocialAccountsController } from './social-accounts.controller';
import { SocialAccountsService } from './social-accounts.service';

@Module({
  imports: [YoutubeModule, TikTokModule],
  controllers: [SocialAccountsController],
  providers: [SocialAccountsService],
  exports: [SocialAccountsService],
})
export class SocialAccountsModule {}