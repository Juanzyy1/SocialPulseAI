import { redactSecrets, safeErrorMessage } from './redact';

const JWT = 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.firma-de-prueba_abc';

describe('redactSecrets', () => {
  it('oculta un JWT dentro de un mensaje', () => {
    const out = redactSecrets(`Token inválido: ${JWT}`);
    expect(out).not.toContain('eyJhbGci');
    expect(out).not.toContain('firma-de-prueba');
    expect(out).toContain('[redactado]');
  });

  it('oculta un access token de Google', () => {
    const out = redactSecrets('Falló con ya29.a0AfB_byC-ejemplo_de_token en la petición');
    expect(out).not.toContain('ya29');
    expect(out).not.toContain('ejemplo_de_token');
  });

  it('oculta un refresh token de Google', () => {
    const out = redactSecrets('Rechazado: 1//0gEjemploDeRefreshToken-abc_123');
    expect(out).not.toContain('EjemploDeRefresh');
  });

  it('oculta una cabecera Bearer', () => {
    const out = redactSecrets('Authorization: Bearer abc.def-ghi');
    expect(out).not.toContain('abc.def-ghi');
    expect(out).toContain('Bearer [redactado]');
  });

  it('conserva el nombre del parámetro pero oculta su valor', () => {
    const out = redactSecrets('client_secret=GOCSPX-secreto-de-prueba&code=4/0AbCd');
    expect(out).toContain('client_secret=[redactado]');
    expect(out).toContain('code=[redactado]');
    expect(out).not.toContain('GOCSPX');
    expect(out).not.toContain('0AbCd');
  });

  it('oculta cualquier cadena opaca de 32 caracteres o más', () => {
    const opaque = 'A'.repeat(20) + 'b'.repeat(20);
    expect(redactSecrets(`valor ${opaque} fin`)).toBe('valor [redactado] fin');
  });

  it('no altera los mensajes normales', () => {
    for (const message of [
      'YouTube respondió 403',
      'Google respondió 400 al renovar el token',
      'El nonce no coincide',
      'Google no devolvió access_token',
    ]) {
      expect(redactSecrets(message)).toBe(message);
    }
  });

  it('limita la longitud a 300 caracteres', () => {
    expect(redactSecrets('a b '.repeat(200)).length).toBeLessThanOrEqual(300);
  });
});

describe('safeErrorMessage', () => {
  it('devuelve un texto genérico si no es un Error', () => {
    expect(safeErrorMessage('cadena suelta')).toBe('error desconocido');
    expect(safeErrorMessage(undefined)).toBe('error desconocido');
  });

  it('oculta los secretos del mensaje de un Error', () => {
    const out = safeErrorMessage(new Error(`Falló con ${JWT}`));
    expect(out).not.toContain('eyJhbGci');
  });
});