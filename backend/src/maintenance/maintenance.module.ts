import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SessionCleanupService } from './session-cleanup.service';

@Module({
  imports: [AuthModule],
  providers: [SessionCleanupService],
})
export class MaintenanceModule {}