import { Module } from '@nestjs/common';
import { UnavailableVideoAnalyzer, UnavailableVideoStorage } from './unavailable';
import { VIDEO_ANALYZER } from './video-analyzer.port';
import { VIDEO_STORAGE } from './video-storage.port';

/**
 * Arquitectura del laboratorio de videos con IA (etapa 7). Todavía no hay adaptadores reales: cuando
 * existan, se sustituyen aquí las dos clases "no disponible" sin tocar nada más.
 */
@Module({
  providers: [
    { provide: VIDEO_STORAGE, useClass: UnavailableVideoStorage },
    { provide: VIDEO_ANALYZER, useClass: UnavailableVideoAnalyzer },
  ],
  exports: [VIDEO_STORAGE, VIDEO_ANALYZER],
})
export class AiLabModule {}