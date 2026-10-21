import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { YoutubeModule } from '../integrations/youtube/youtube.module';
import { AnalyticsProbeController } from './analytics-probe.controller';
import { ANALYTICS_PROBE_ENABLED, AnalyticsProbeService } from './analytics-probe.service';

@Module({
  imports: [YoutubeModule],
  controllers: [AnalyticsProbeController],
  providers: [
    AnalyticsProbeService,
    {
      provide: ANALYTICS_PROBE_ENABLED,
      useFactory: (config: ConfigService) => config.get('NODE_ENV') !== 'production',
      inject: [ConfigService],
    },
  ],
})
export class AnalyticsModule {}