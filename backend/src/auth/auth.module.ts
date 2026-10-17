import { Module } from '@nestjs/common';
import { PasswordService } from './password.service';
import { SessionsService } from './sessions.service';

@Module({
  providers: [PasswordService, SessionsService],
  exports: [PasswordService, SessionsService],
})
export class AuthModule {}