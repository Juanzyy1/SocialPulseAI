import type { AspectClass } from './video-rules';

export const VIDEO_ANALYZER = Symbol('VIDEO_ANALYZER');

export type TargetPlatform = 'YOUTUBE' | 'INSTAGRAM' | 'TIKTOK';

export interface VideoAnalysisInput {
  videoKey: string;
  aspect: AspectClass;
  durationSeconds: number;
  targetPlatform: TargetPlatform;
  /** Objetivo declarado por quien sube el video (texto libre, ya acotado en longitud). */
  objective?: string;
}

/** Quién mira el video y propone títulos, descripción, hashtags y mejoras. Cada proveedor es un adaptador. */
export interface VideoAnalyzer {
  /**
   * Devuelve la respuesta CRUDA del modelo. Es `unknown` a propósito: el sistema debe pasarla por
   * `finalizeAnalysis` antes de usarla, y ningún adaptador puede saltarse esa validación.
   */
  analyze(input: VideoAnalysisInput): Promise<unknown>;
}