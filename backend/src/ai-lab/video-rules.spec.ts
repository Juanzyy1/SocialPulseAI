import { Buffer } from 'node:buffer';
import { classifyAspectRatio, sniffVideoContainer, validateVideoMeta, VIDEO_LIMITS } from './video-rules';
import type { VideoMeta } from './video-rules';

describe('classifyAspectRatio', () => {
  it.each([
    [1080, 1920, 'vertical'],
    [2160, 3840, 'vertical'],
    [720, 1280, 'vertical'],
    [573, 1000, 'vertical'], // justo dentro de la tolerancia del 2 %
    [1920, 1080, 'horizontal'],
    [1280, 720, 'horizontal'],
    [3840, 2160, 'horizontal'],
    [1813, 1000, 'horizontal'],
    [1080, 1080, 'square'],
    [1000, 1020, 'square'],
  ])('%d x %d es %s', (width, height, kind) => {
    expect(classifyAspectRatio(width, height)).toBe(kind);
  });

  it.each([
    [1080, 1350], // 4:5
    [1080, 2340], // 19,5:9
    [1440, 1080], // 4:3
    [1920, 1200], // 16:10
    [1000, 1030],
    [574, 1000], // justo fuera de la tolerancia
    [1814, 1000],
    [0, 1080],
    [1080, 0],
    [-1080, 1920],
    [Number.NaN, 1080],
    [Number.POSITIVE_INFINITY, 1080],
  ])('%d x %d no es una proporción admitida', (width, height) => {
    expect(classifyAspectRatio(width, height)).toBeNull();
  });
});

describe('sniffVideoContainer', () => {
  const ftyp = (brand: string) =>
    Buffer.concat([Buffer.from([0, 0, 0, 32]), Buffer.from('ftyp', 'latin1'), Buffer.from(brand, 'latin1'), Buffer.alloc(20)]);
  const ebml = (docType: string) =>
    Buffer.concat([
      Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01]),
      Buffer.from(docType, 'latin1'),
      Buffer.alloc(20),
    ]);

  it('reconoce MP4, MOV y WebM por su contenido', () => {
    expect(sniffVideoContainer(ftyp('isom'))).toBe('mp4');
    expect(sniffVideoContainer(ftyp('mp42'))).toBe('mp4');
    expect(sniffVideoContainer(ftyp('qt  '))).toBe('mov');
    expect(sniffVideoContainer(ebml('webm'))).toBe('webm');
  });

  it('no confunde con video otros contenedores ni otros tipos de archivo', () => {
    expect(sniffVideoContainer(ebml('matroska'))).toBeNull();
    expect(sniffVideoContainer(ftyp('heic'))).toBeNull();
    expect(sniffVideoContainer(ftyp('M4A '))).toBeNull();
    expect(sniffVideoContainer(Buffer.from('%PDF-1.7 contenido de un documento'))).toBeNull();
    expect(sniffVideoContainer(Buffer.from('hola mundo, esto no es un video aunque se llame .mp4'))).toBeNull();
  });

  it('una cabecera vacía o demasiado corta no se reconoce', () => {
    expect(sniffVideoContainer(Buffer.alloc(0))).toBeNull();
    expect(sniffVideoContainer(Buffer.from([0x1a, 0x45]))).toBeNull();
    expect(sniffVideoContainer(Buffer.from('....ftyp'))).toBeNull();
  });
});

describe('validateVideoMeta', () => {
  const MB = 1024 * 1024;
  const base: VideoMeta = { sizeBytes: 50 * MB, durationSeconds: 45, width: 1080, height: 1920, container: 'mp4' };
  const codes = (meta: Partial<VideoMeta>) => validateVideoMeta({ ...base, ...meta }).problems.map((p) => p.code);

  it('los límites son los propuestos', () => {
    expect(VIDEO_LIMITS).toEqual({
      maxSizeBytes: 200 * MB,
      maxDurationSeconds: 300,
      minShortSidePx: 360,
      maxLongSidePx: 4096,
    });
  });

  it('un video vertical válido no tiene problemas y se clasifica', () => {
    expect(validateVideoMeta(base)).toEqual({ ok: true, problems: [], aspect: 'vertical' });
  });

  it('acepta horizontal y cuadrado, en cualquiera de los tres formatos', () => {
    expect(validateVideoMeta({ ...base, width: 3840, height: 2160, container: 'mov' }).aspect).toBe('horizontal');
    expect(validateVideoMeta({ ...base, width: 1080, height: 1080, container: 'webm' }).aspect).toBe('square');
  });

  it('acepta exactamente los valores máximos y mínimos', () => {
    expect(validateVideoMeta({ ...base, sizeBytes: VIDEO_LIMITS.maxSizeBytes }).ok).toBe(true);
    expect(validateVideoMeta({ ...base, durationSeconds: 300 }).ok).toBe(true);
    expect(validateVideoMeta({ ...base, width: 4096, height: 2304 }).ok).toBe(true);
    expect(validateVideoMeta({ ...base, width: 360, height: 640 }).ok).toBe(true);
  });

  it('rechaza lo que supera los límites por muy poco', () => {
    expect(codes({ sizeBytes: VIDEO_LIMITS.maxSizeBytes + 1 })).toEqual(['TOO_LARGE']);
    expect(codes({ durationSeconds: 301 })).toEqual(['TOO_LONG']);
    expect(codes({ width: 4097, height: 2304 })).toEqual(['RESOLUTION_TOO_HIGH']);
    expect(codes({ width: 359, height: 638 })).toEqual(['RESOLUTION_TOO_LOW']);
  });

  it('un archivo vacío, un formato desconocido y una duración inválida se informan', () => {
    expect(codes({ sizeBytes: 0 })).toEqual(['EMPTY_FILE']);
    expect(codes({ container: null })).toEqual(['UNSUPPORTED_FORMAT']);
    for (const durationSeconds of [Number.NaN, 0, -1]) {
      expect(codes({ durationSeconds })).toEqual(['INVALID_DURATION']);
    }
  });

  it('unas dimensiones inválidas se informan solas, sin ruido de resolución ni de proporción', () => {
    const result = validateVideoMeta({ ...base, width: 0 });

    expect(result.problems.map((p) => p.code)).toEqual(['INVALID_DIMENSIONS']);
    expect(result.aspect).toBeNull();
  });

  it('una proporción no admitida (4:5) lo dice y nombra las admitidas', () => {
    const result = validateVideoMeta({ ...base, width: 1080, height: 1350 });

    expect(result.ok).toBe(false);
    expect(result.problems.map((p) => p.code)).toEqual(['UNSUPPORTED_ASPECT']);
    expect(result.problems[0]?.message).toContain('9:16');
    expect(result.problems[0]?.message).toContain('16:9');
    expect(result.problems[0]?.message).toContain('1:1');
  });

  it('informa todos los problemas a la vez, en orden estable', () => {
    expect(codes({ sizeBytes: 300 * MB, durationSeconds: 400, container: null, width: 1080, height: 1350 })).toEqual([
      'TOO_LARGE',
      'UNSUPPORTED_FORMAT',
      'TOO_LONG',
      'UNSUPPORTED_ASPECT',
    ]);
  });

  it('los mensajes llevan cifras legibles en español', () => {
    const large = validateVideoMeta({ ...base, sizeBytes: 300 * MB }).problems[0]?.message;
    const long = validateVideoMeta({ ...base, durationSeconds: 301 }).problems[0]?.message;
    const longer = validateVideoMeta({ ...base, durationSeconds: 400 }).problems[0]?.message;

    expect(large).toBe('El archivo pesa 300,0 MB y el máximo es 200,0 MB');
    expect(long).toBe('El video dura 5 min 1 s y el máximo es 5 min');
    expect(longer).toContain('6 min 40 s');
  });
});