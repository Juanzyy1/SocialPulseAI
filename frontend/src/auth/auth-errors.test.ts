import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import { describeAuthError, describeOAuthLoginError, registerFailureMessage } from './auth-errors';

describe('describeAuthError', () => {
  it.each([
    [0, 'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.'],
    [401, 'El correo o la contraseña no son correctos.'],
    [403, 'No se pudo completar la solicitud desde este sitio. Recarga la página e inténtalo de nuevo.'],
    [409, 'Ya existe una cuenta con ese correo. Prueba a iniciar sesión.'],
    [429, 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.'],
    [500, 'El servidor tuvo un problema. Inténtalo de nuevo en unos minutos.'],
    [418, 'No se pudo completar la solicitud.'],
  ])('el estado %i da su mensaje en español', (status, message) => {
    expect(describeAuthError(new ApiError(status, 'texto interno del backend'), 'login')).toBe(message);
  });

  it('un 400 de registro muestra el aviso de versión de términos y, si no, un mensaje genérico', () => {
    const outdated = new ApiError(
      400,
      'La versión de los términos no está vigente; recarga la página e inténtalo de nuevo',
    );

    expect(describeAuthError(outdated, 'register')).toBe(outdated.message);
    expect(describeAuthError(outdated, 'login')).toBe('Revisa los datos e inténtalo de nuevo.');
    expect(describeAuthError(new ApiError(400, 'email must be an email'), 'register')).toBe(
      'Revisa los datos e inténtalo de nuevo.',
    );
  });

  it('un error que no es de la API da un mensaje genérico y no expone su texto', () => {
    expect(describeAuthError(new Error('contiene un secreto'), 'login')).toBe(
      'Ocurrió un error inesperado. Inténtalo de nuevo.',
    );
  });
});

describe('registerFailureMessage', () => {
  it('un fallo en el registro usa el mensaje del error', () => {
    const failure = { ok: false as const, stage: 'register' as const, error: new ApiError(409, 'x') };

    expect(registerFailureMessage(failure)).toBe(
      'Ya existe una cuenta con ese correo. Prueba a iniciar sesión.',
    );
  });

  it('un fallo al iniciar sesión tras registrarse explica que la cuenta sí se creó', () => {
    const failure = { ok: false as const, stage: 'login' as const, error: new ApiError(429, 'x') };

    expect(registerFailureMessage(failure)).toContain('Tu cuenta se creó');
  });
});

describe('describeOAuthLoginError', () => {
  it('traduce los códigos conocidos y usa un mensaje genérico para los desconocidos', () => {
    expect(describeOAuthLoginError('rejected')).toContain('No se pudo completar el acceso con Google');
    expect(describeOAuthLoginError('unauthorized')).toContain('identidad');
    expect(describeOAuthLoginError('google_error')).toContain('comunicarse');
    expect(describeOAuthLoginError('unavailable')).toContain('no está disponible');
    expect(describeOAuthLoginError('<script>alert(1)</script>')).toBe(
      'No se pudo completar el acceso con Google.',
    );
  });

  it('sin código no hay mensaje', () => {
    expect(describeOAuthLoginError(null)).toBeNull();
  });
});