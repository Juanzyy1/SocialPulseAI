import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import { describeLoadError } from './errors';

describe('describeLoadError', () => {
  it.each([
    [0, 'No se pudo contactar con el servidor. Revisa tu conexión.'],
    [404, 'No encontramos esta cuenta. Puede haberse desconectado.'],
    [429, 'Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.'],
    [500, 'No se pudieron cargar los datos. Inténtalo de nuevo.'],
  ])('el estado %i da su mensaje', (status, message) => {
    expect(describeLoadError(new ApiError(status, 'texto interno'))).toBe(message);
  });

  it('un error que no es de la API da el mensaje genérico y no expone su texto', () => {
    expect(describeLoadError(new Error('contiene un secreto'))).toBe(
      'No se pudieron cargar los datos. Inténtalo de nuevo.',
    );
  });
});