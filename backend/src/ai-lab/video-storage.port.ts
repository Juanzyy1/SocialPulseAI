import type { Readable } from 'node:stream';

export const VIDEO_STORAGE = Symbol('VIDEO_STORAGE');

export interface StoredVideo {
  /**
   * Clave opaca generada por el servidor (por ejemplo, un UUID). NUNCA se deriva del nombre que da quien
   * sube el archivo: eso permitiría recorrer rutas del disco.
   */
  key: string;
  sizeBytes: number;
}

export interface SaveVideoInput {
  userId: string;
  stream: Readable;
  /** Se aborta la escritura si el archivo supera este tamaño mientras se recibe. */
  maxBytes: number;
}

/** Dónde se guardan los videos subidos. Cada implementación (disco, nube...) es un adaptador. */
export interface VideoStorage {
  save(input: SaveVideoInput): Promise<StoredVideo>;
  open(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
}