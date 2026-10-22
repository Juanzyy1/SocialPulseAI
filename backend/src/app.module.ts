import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { YoutubeModule } from './integrations/youtube/youtube.module';
import { PrismaModule } from './prisma/prisma.module';
import { SocialAccountsModule } from './social-accounts/dto/social-accounts.module';
import { SyncModule } from './sync/sync.module';
import { UsersModule } from './users/dto/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    CryptoModule,
    AuthModule,
    UsersModule,
    YoutubeModule,
    SocialAccountsModule,
    SyncModule,
    AnalyticsModule,
    HealthModule,
  ],
})
export class AppModule {}