import { HttpException } from '@nestjs/common';
import { oauthFailureCode } from './oauth-failure-code';

describe('oauthFailureCode', () => {
  it.each([
    [400, 'rejected'],
    [401, 'unauthorized'],
    [409, 'already_connected'],
    [502, 'google_error'],
    [503, 'unavailable'],
    [500, 'error'],
    [429, 'error'],
  ])('el estado HTTP %i da el código %s', (status, code) => {
    expect(oauthFailureCode(new HttpException('mensaje interno', status))).toBe(code);
  });

  it('un error que no es HttpException da "error" y no expone su mensaje', () => {
    expect(oauthFailureCode(new Error('contiene un secreto'))).toBe('error');
  });
});