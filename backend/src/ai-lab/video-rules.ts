/** Reglas de los videos que acepta el laboratorio de IA. Son propuestas: se ajustan aquí y solo aquí. */
export const VIDEO_LIMITS = {
  maxSizeBytes: 200 * 1024 * 1024,
  maxDurationSeconds: 300,
  minShortSidePx: 360,
  maxLongSidePx: 4096,
} as const;

export type VideoContainer = 'mp4' | 'mov' | 'webm';
export type AspectClass = 'vertical' | 'horizontal' | 'square';

/**
 * Proporciones admitidas: 9:16, 16:9 y 1:1. Se tolera una diferencia relativa de hasta el 2 %
 * (redondeos de resolución). Las dimensiones deben ser las de visualización, ya con la rotación aplicada.
 */
const ASPECTS: ReadonlyArray<{ kind: AspectClass; ratio: number }> = [
  { kind: 'vertical', ratio: 9 / 16 },
  { kind: 'horizontal', ratio: 16 / 9 },
  { kind: 'square', ratio: 1 },
];
const ASPECT_TOLERANCE = 0.02;

export function classifyAspectRatio(width: number, height: number): AspectClass | null {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  const ratio = width / height;
  const match = ASPECTS.find((aspect) => Math.abs(ratio - aspect.ratio) / aspect.ratio <= ASPECT_TOLERANCE);
  return match?.kind ?? null;
}

const MP4_BRANDS = new Set(['isom', 'iso2', 'iso3', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1', 'M4V ', 'dash']);

function ascii(bytes: Uint8Array, start: number, end: number): string {
  return String.fromCharCode(...bytes.subarray(start, Math.min(end, bytes.length)));
}

/**
 * Formato real según los primeros bytes del archivo. El nombre y el Content-Type los controla quien
 * sube el archivo y no son fiables. Que la cabecera sea válida NO prueba que el archivo sea seguro:
 * después hay que decodificarlo en un proceso aislado.
 */
export function sniffVideoContainer(header: Uint8Array): VideoContainer | null {
  // WebM (EBML): firma 1A 45 DF A3 y tipo de documento "webm" (un .mkv dice "matroska").
  if (header.length >= 4 && header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3) {
    return ascii(header, 0, 64).includes('webm') ? 'webm' : null;
  }
  // MP4 y MOV (ISO BMFF): "ftyp" en los bytes 4-7 y la marca en los bytes 8-11.
  if (header.length >= 12 && ascii(header, 4, 8) === 'ftyp') {
    const brand = ascii(header, 8, 12);
    if (brand === 'qt  ') return 'mov';
    return MP4_BRANDS.has(brand) ? 'mp4' : null; // otras marcas (HEIC, M4A...) no son video
  }
  return null;
}

export interface VideoMeta {
  sizeBytes: number;
  durationSeconds: number;
  /** Dimensiones de visualización (con la rotación ya aplicada). */
  width: number;
  height: number;
  container: VideoContainer | null;
}

export type VideoProblemCode =
  | 'EMPTY_FILE'
  | 'TOO_LARGE'
  | 'UNSUPPORTED_FORMAT'
  | 'INVALID_DURATION'
  | 'TOO_LONG'
  | 'INVALID_DIMENSIONS'
  | 'RESOLUTION_TOO_LOW'
  | 'RESOLUTION_TOO_HIGH'
  | 'UNSUPPORTED_ASPECT';

export interface VideoProblem {
  code: VideoProblemCode;
  message: string;
}

export interface VideoValidation {
  ok: boolean;
  problems: VideoProblem[];
  aspect: AspectClass | null;
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

function formatSeconds(totalSeconds: number): string {
  const total = Math.round(totalSeconds);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes === 0) return `${seconds} s`;
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
}

const isPositive = (value: number) => Number.isFinite(value) && value > 0;

/** Comprueba los datos de un video contra los límites. Devuelve todos los problemas, no solo el primero. */
export function validateVideoMeta(meta: VideoMeta): VideoValidation {
  const problems: VideoProblem[] = [];
  const add = (code: VideoProblemCode, message: string) => problems.push({ code, message });

  if (!isPositive(meta.sizeBytes)) {
    add('EMPTY_FILE', 'El archivo está vacío');
  } else if (meta.sizeBytes > VIDEO_LIMITS.maxSizeBytes) {
    add(
      'TOO_LARGE',
      `El archivo pesa ${formatMegabytes(meta.sizeBytes)} y el máximo es ${formatMegabytes(VIDEO_LIMITS.maxSizeBytes)}`,
    );
  }

  if (meta.container === null) {
    add('UNSUPPORTED_FORMAT', 'Formato no admitido: usa MP4, MOV o WebM');
  }

  if (!isPositive(meta.durationSeconds)) {
    add('INVALID_DURATION', 'No se pudo determinar la duración del video');
  } else if (meta.durationSeconds > VIDEO_LIMITS.maxDurationSeconds) {
    add(
      'TOO_LONG',
      `El video dura ${formatSeconds(meta.durationSeconds)} y el máximo es ${formatSeconds(VIDEO_LIMITS.maxDurationSeconds)}`,
    );
  }

  let aspect: AspectClass | null = null;
  if (!isPositive(meta.width) || !isPositive(meta.height)) {
    add('INVALID_DIMENSIONS', 'No se pudieron determinar las dimensiones del video');
  } else {
    if (Math.min(meta.width, meta.height) < VIDEO_LIMITS.minShortSidePx) {
      add(
        'RESOLUTION_TOO_LOW',
        `La resolución es demasiado baja: el lado menor debe tener al menos ${VIDEO_LIMITS.minShortSidePx} px`,
      );
    }
    if (Math.max(meta.width, meta.height) > VIDEO_LIMITS.maxLongSidePx) {
      add(
        'RESOLUTION_TOO_HIGH',
        `La resolución es demasiado alta: el lado mayor no puede superar ${VIDEO_LIMITS.maxLongSidePx} px`,
      );
    }
    aspect = classifyAspectRatio(meta.width, meta.height);
    if (aspect === null) {
      add('UNSUPPORTED_ASPECT', 'La proporción no es admitida: usa vertical 9:16, horizontal 16:9 o cuadrado 1:1');
    }
  }

  return { ok: problems.length === 0, problems, aspect };
}