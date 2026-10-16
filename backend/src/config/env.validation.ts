export interface Env {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  DATABASE_URL: string;
}

const NODE_ENVS = ['development', 'test', 'production'] as const;

/**
 * Valida las variables de entorno al arrancar. Si alguna es inválida,
 * lanza un error y la aplicación no inicia. Nunca incluye valores en los
 * mensajes (la URL de la base contiene la clave).
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

  if (errors.length > 0) {
    throw new Error(
      `Configuración de entorno inválida:\n- ${errors.join('\n- ')}`,
    );
  }

  return {
    NODE_ENV: nodeEnv as Env['NODE_ENV'],
    PORT: port,
    DATABASE_URL: databaseUrl,
  };
}