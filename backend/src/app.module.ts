import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { YoutubeModule } from './integrations/youtube/youtube.module';
import { PrismaModule } from './prisma/prisma.module';
import { SocialAccountsModule } from './social-accounts/dto/social-accounts.module';
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
    HealthModule,
  ],
})
export class AppModule {}