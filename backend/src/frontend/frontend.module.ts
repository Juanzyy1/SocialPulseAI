import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FRONTEND_ORIGIN } from './frontend-origin';
import { FrontendRedirects } from './frontend-redirects';

// Global: cualquier módulo puede inyectar FrontendRedirects sin importar este módulo.
@Global()
@Module({
  providers: [
    {
      provide: FRONTEND_ORIGIN,
      useFactory: (config: ConfigService): string | null => {
        const url = config.get<string>('FRONTEND_URL');
        return url ? new URL(url).origin : null; // ya validada al arrancar
      },
      inject: [ConfigService],
    },
    FrontendRedirects,
  ],
  exports: [FRONTEND_ORIGIN, FrontendRedirects],
})
export class FrontendModule {}