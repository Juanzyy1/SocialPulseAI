import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleAuthController } from './google-auth.controller';
import { GoogleAuthService } from './google-auth.service';
import { GoogleOAuthClient, GoogleOAuthClientImpl } from './google-oauth.client';
import { PasswordService } from './password.service';
import { DEFAULT_RATE_LIMITS, RATE_LIMIT_CONFIG } from './rate-limit.config';
import { RateLimiterService } from './rate-limiter.service';
import { SessionAuthGuard } from './session-auth.guard';
import { SessionsService } from './sessions.service';

@Module({
  controllers: [AuthController, GoogleAuthController],
  providers: [
    AuthService,
    GoogleAuthService,
    PasswordService,
    SessionsService,
    RateLimiterService,
    { provide: RATE_LIMIT_CONFIG, useValue: DEFAULT_RATE_LIMITS },
    { provide: GoogleOAuthClient, useClass: GoogleOAuthClientImpl },
    // Guard global: toda la API exige sesión salvo lo marcado con @Public().
    { provide: APP_GUARD, useClass: SessionAuthGuard },
  ],
  exports: [PasswordService, SessionsService],
})
export class AuthModule {}