export interface Env {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
  TOKEN_ENCRYPTION_KEY: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
}

const NODE_ENVS = ['development', 'test', 'production'] as const;
const GOOGLE_KEYS = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REDIRECT_URI',
] as const;
const LOCAL_HOSTS = ['localhost', '127.0.0.1'];

function optionalString(value: unknown): string | undefined {
  const text = typeof value === 'string' ? value.trim() : '';
  return text === '' ? undefined : text;
}

/** 32 bytes en base64 son exactamente 44 caracteres (43 + un "="). */
function isValidEncryptionKey(value: string): boolean {
  return /^[A-Za-z0-9+/]{43}=$/.test(value) && Buffer.from(value, 'base64').length === 32;
}

/** Devuelve un mensaje de error si el URI de retorno de Google no es aceptable. */
function checkRedirectUri(value: string, isProduction: boolean): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'GOOGLE_REDIRECT_URI no es una URL válida';
  }
  if (url.protocol === 'https:') return null;
  if (!isProduction && url.protocol === 'http:' && LOCAL_HOSTS.includes(url.hostname)) {
    return null;
  }
  return isProduction
    ? 'GOOGLE_REDIRECT_URI debe usar https en producción'
    : 'GOOGLE_REDIRECT_URI debe ser https (o http solo en localhost)';
}

/**
 * Valida las variables de entorno al arrancar. Si alguna es inválida,
 * lanza un error y la aplicación no inicia. Nunca incluye valores en los
 * mensajes (la URL de la base, la clave de cifrado y el secreto de Google
 * son sensibles).
 */
export function validateEnv(raw: Record<string, unknown>): Env {
  const errors: string[] = [];

  const nodeEnv = String(raw.NODE_ENV ?? 'development');
  if (!NODE_ENVS.includes(nodeEnv as Env['NODE_ENV'])) {
    errors.push(`NODE_ENV debe ser uno de: ${NODE_ENVS.join(', ')}`);
  }

  const port = Number(raw.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    errors.push('PORT debe ser un entero entre 1 y 65535');
  }

  const databaseUrl = String(raw.DATABASE_URL ?? '');
  if (!/^postgres(ql)?:\/\//.test(databaseUrl)) {
    errors.push('DATABASE_URL debe ser una URL que empiece por postgresql://');
  }

  const encryptionKey = String(raw.TOKEN_ENCRYPTION_KEY ?? '').trim();
  if (!isValidEncryptionKey(encryptionKey)) {
    errors.push(
      'TOKEN_ENCRYPTION_KEY es obligatoria: 32 bytes aleatorios en base64 (44 caracteres)',
    );
  }

  // Google OAuth: las tres variables juntas o ninguna.
  const clientId = optionalString(raw.GOOGLE_CLIENT_ID);
  const clientSecret = optionalString(raw.GOOGLE_CLIENT_SECRET);
  const redirectUri = optionalString(raw.GOOGLE_REDIRECT_URI);
  const googleValues = [clientId, clientSecret, redirectUri];
  const googleSet = googleValues.filter((v) => v !== undefined).length;
  if (googleSet > 0 && googleSet < GOOGLE_KEYS.length) {
    errors.push(
      `Google OAuth está incompleto: define las tres variables (${GOOGLE_KEYS.join(', ')}) o ninguna`,
    );
  }
  if (redirectUri) {
    const problem = checkRedirectUri(redirectUri, nodeEnv === 'production');
    if (problem) errors.push(problem);
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuración de entorno inválida:\n- ${errors.join('\n- ')}`,
    );
  }

  return {
    NODE_ENV: nodeEnv as Env['NODE_ENV'],
    PORT: port,
    DATABASE_URL: databaseUrl,
    TOKEN_ENCRYPTION_KEY: encryptionKey,
    GOOGLE_CLIENT_ID: clientId,
    GOOGLE_CLIENT_SECRET: clientSecret,
    GOOGLE_REDIRECT_URI: redirectUri,
  };
}