import { Module } from '@nestjs/common';
import { YoutubeModule } from '../../integrations/youtube/youtube.module';
import { SocialAccountsController } from '../social-accounts.controller';
import { SocialAccountsService } from '../social-accounts.service';

@Module({
  imports: [YoutubeModule],
  controllers: [SocialAccountsController],
  providers: [SocialAccountsService],
})
export class SocialAccountsModule {}