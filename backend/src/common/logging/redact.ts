const MAX_LENGTH = 300;

// El orden importa: primero los formatos conocidos y, al final, cualquier cadena larga opaca.
const PATTERNS: Array<[RegExp, string]> = [
  // Credenciales dentro de una URL (esquema://usuario:clave@host): se ocultan el usuario y la clave.
  [/\b([a-z][a-z0-9+.-]*:\/\/)[^\s/@:]*(?::[^\s/@]*)?@/gi, '$1[redactado]@'],
  [/eyJ[\w-]+\.[\w-]+\.[\w-]*/g, '[redactado]'], // JWT (id_token)
  [/ya29\.[\w-]+/g, '[redactado]'], // access token de Google
  [/1\/\/[\w-]+/g, '[redactado]'], // refresh token de Google
  [/Bearer\s+[\w.~+/=-]+/gi, 'Bearer [redactado]'],
  [
    /((?:^|[\s?&;,])(?:database_password|client_secret|refresh_token|access_token|id_token|code_verifier|code|password|passwd|pwd|secret|token|api_key|apikey)\s*=\s*)[^&\s;,]*/gi,
    '$1[redactado]',
  ],
  [/\b[A-Za-z0-9_+/=-]{32,}\b/g, '[redactado]'],
];

/** Oculta cualquier cosa con forma de token o secreto y limita la longitud. */
export function redactSecrets(text: string): string {
  const clean = PATTERNS.reduce(
    (acc, [pattern, replacement]) => acc.replace(pattern, replacement),
    text,
  );
  return clean.slice(0, MAX_LENGTH);
}

/** Mensaje de un error listo para registrar: sin secretos y de longitud acotada. */
export function safeErrorMessage(error: unknown): string {
  return redactSecrets(error instanceof Error ? error.message : 'error desconocido');
}