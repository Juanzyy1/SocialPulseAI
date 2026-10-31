import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import type { Readable } from 'node:stream';
import type { VideoAnalyzer } from './video-analyzer.port';
import type { StoredVideo, VideoStorage } from './video-storage.port';

export const AI_LAB_UNAVAILABLE_MESSAGE = 'El laboratorio de IA todavía no está disponible';

const unavailable = () => new ServiceUnavailableException(AI_LAB_UNAVAILABLE_MESSAGE);

/** Sin adaptador real, cada operación falla con un 503 claro: nada finge funcionar. */
@Injectable()
export class UnavailableVideoStorage implements VideoStorage {
  save(): Promise<StoredVideo> {
    return Promise.reject(unavailable());
  }
  open(): Promise<Readable> {
    return Promise.reject(unavailable());
  }
  delete(): Promise<void> {
    return Promise.reject(unavailable());
  }
}

@Injectable()
export class UnavailableVideoAnalyzer implements VideoAnalyzer {
  analyze(): Promise<unknown> {
    return Promise.reject(unavailable());
  }
}