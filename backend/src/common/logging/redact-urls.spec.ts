import { redactSecrets, safeErrorMessage } from './redact';

describe('redactSecrets: credenciales dentro de URLs', () => {
  it.each([
    ['postgresql://usuario:clave-secreta@localhost:5432/db', 'postgresql://[redactado]@localhost:5432/db'],
    ['redis://:solo-clave@cache:6379', 'redis://[redactado]@cache:6379'],
    ['https://token123@api.ejemplo.com/v1', 'https://[redactado]@api.ejemplo.com/v1'],
    [
      'copia de postgres://a:b@uno/x hacia postgres://c:d@dos/y',
      'copia de postgres://[redactado]@uno/x hacia postgres://[redactado]@dos/y',
    ],
  ])('oculta usuario y clave en «%s»', (input, expected) => {
    expect(redactSecrets(input)).toBe(expected);
  });

  it('el error del ejemplo ya no deja pasar la clave a los registros', () => {
    const message = safeErrorMessage(new Error('postgresql://usuario:clave-secreta@host/db falló'));

    expect(message).not.toContain('clave-secreta');
    expect(message).not.toContain('usuario');
    expect(message).toContain('host/db');
  });

  it.each([
    'https://accounts.google.com/o/oauth2/v2/auth?scope=email',
    'http://localhost:3000/api/v1/health',
    'https://example.com:8080/ruta@algo',
    'Falló el correo ana@example.com',
  ])('no toca «%s»', (input) => {
    expect(redactSecrets(input)).toBe(input);
  });
});

describe('redactSecrets: pares clave=valor', () => {
  it.each([
    ['password=abc123', 'password=[redactado]'],
    ['DATABASE_PASSWORD=hunter2 y más texto', 'DATABASE_PASSWORD=[redactado] y más texto'],
    ['secret=xyz&otro=1', 'secret=[redactado]&otro=1'],
    ['api_key=ABC', 'api_key=[redactado]'],
    ['Token=abc', 'Token=[redactado]'],
  ])('oculta el valor de «%s»', (input, expected) => {
    expect(redactSecrets(input)).toBe(expected);
  });

  it('no toca palabras que solo contienen esos nombres', () => {
    expect(redactSecrets('passwordless=false y tokens=3')).toBe('passwordless=false y tokens=3');
  });
});