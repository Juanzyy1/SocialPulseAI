import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SocialAccountsModule } from '../social-accounts/social-accounts.module';
import { AccountController } from './account.controller';
import { AccountService } from './account.service';

@Module({
  imports: [AuthModule, SocialAccountsModule],
  controllers: [AccountController],
  providers: [AccountService],
})
export class AccountModule {}