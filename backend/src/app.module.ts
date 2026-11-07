import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AnalyticsModule } from './analytics/analytics.module';
import { AuthModule } from './auth/auth.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { validateEnv } from './config/env.validation';
import { FrontendModule } from './frontend/frontend.module';
import { HealthModule } from './health/health.module';
import { YoutubeModule } from './integrations/youtube/youtube.module';
import { InstagramModule } from './integrations/instagram/instagram.module';
import { PrismaModule } from './prisma/prisma.module';
import { SocialAccountsModule } from './social-accounts/social-accounts.module';
import { SyncModule } from './sync/sync.module';
import { UsersModule } from './users/dto/users.module';
import { AiLabModule } from './ai-lab/ai-lab.module';
import { AccountModule } from './account/account.module';
import { MaintenanceModule } from './maintenance/maintenance.module';
import { DiagnosticsModule } from './diagnostics/diagnostics.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    CryptoModule,
    FrontendModule,
    AuthModule,
    UsersModule,
    YoutubeModule,
    InstagramModule,
    SocialAccountsModule,
    SyncModule,
    AnalyticsModule,
    HealthModule,
    AiLabModule,
    AccountModule,
    MaintenanceModule,
    DiagnosticsModule,
  ],
})
export class AppModule {}