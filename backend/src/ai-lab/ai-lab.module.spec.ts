import { Readable } from 'node:stream';
import { ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AiLabModule } from './ai-lab.module';
import { AI_LAB_UNAVAILABLE_MESSAGE } from './unavailable';
import { VIDEO_ANALYZER } from './video-analyzer.port';
import type { VideoAnalyzer } from './video-analyzer.port';
import { VIDEO_STORAGE } from './video-storage.port';
import type { VideoStorage } from './video-storage.port';

describe('AiLabModule', () => {
  const build = async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AiLabModule] }).compile();
    return {
      storage: moduleRef.get<VideoStorage>(VIDEO_STORAGE),
      analyzer: moduleRef.get<VideoAnalyzer>(VIDEO_ANALYZER),
    };
  };

  it('ofrece los dos puertos', async () => {
    const { storage, analyzer } = await build();

    expect(storage).toBeDefined();
    expect(analyzer).toBeDefined();
  });

  it('el almacenamiento no simula funcionar: cada operación responde 503 con un mensaje claro', async () => {
    const { storage } = await build();
    const calls = [
      () => storage.save({ userId: 'u', stream: Readable.from([]), maxBytes: 1 }),
      () => storage.open('clave'),
      () => storage.delete('clave'),
    ];

    for (const call of calls) {
      await expect(call()).rejects.toThrow(ServiceUnavailableException);
      await expect(call()).rejects.toThrow(AI_LAB_UNAVAILABLE_MESSAGE);
    }
  });

  it('el analizador no simula funcionar: responde 503 con un mensaje claro', async () => {
    const { analyzer } = await build();
    const call = () =>
      analyzer.analyze({ videoKey: 'k', aspect: 'vertical', durationSeconds: 10, targetPlatform: 'YOUTUBE' });

    await expect(call()).rejects.toThrow(ServiceUnavailableException);
    await expect(call()).rejects.toThrow(AI_LAB_UNAVAILABLE_MESSAGE);
  });
});