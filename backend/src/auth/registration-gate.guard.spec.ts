import { ExecutionContext, ForbiddenException, HttpException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import {
  INVITE_REQUIRED_MESSAGE,
  RegistrationGateGuard,
  inviteCodeMatches,
} from './registration-gate.guard';

const CODE = 'codigo-de-invitacion-123';

const contextFor = (request: object) =>
  ({ switchToHttp: () => ({ getRequest: () => request }) }) as unknown as ExecutionContext;
const guardWith = (code: string | undefined) =>
  new RegistrationGateGuard({ get: () => code } as unknown as ConfigService);
const request = (inviteCode: unknown, ip = '203.0.113.7') => ({ ip, body: { inviteCode } });

describe('inviteCodeMatches', () => {
  it('acepta el código exacto, recortando espacios', () => {
    expect(inviteCodeMatches(CODE, CODE)).toBe(true);
    expect(inviteCodeMatches(CODE, `  ${CODE}  `)).toBe(true);
  });

  it('rechaza códigos distintos, de otra longitud, vacíos y lo que no es texto, sin lanzar errores', () => {
    for (const given of ['otro', `${CODE}x`, CODE.slice(1), '', ' ', 12345, null, undefined, {}, [CODE]]) {
      expect(inviteCodeMatches(CODE, given)).toBe(false);
    }
  });

  it('distingue mayúsculas de minúsculas', () => {
    expect(inviteCodeMatches(CODE, CODE.toUpperCase())).toBe(false);
  });
});

describe('RegistrationGateGuard', () => {
  it('sin código configurado el registro está abierto', () => {
    for (const code of [undefined, '']) {
      expect(guardWith(code).canActivate(contextFor(request(undefined)))).toBe(true);
    }
  });

  it('con código configurado, el correcto pasa', () => {
    expect(guardWith(CODE).canActivate(contextFor(request(CODE)))).toBe(true);
  });

  it('el incorrecto o ausente se rechaza con 403 y el mensaje de invitación', () => {
    const guard = guardWith(CODE);

    for (const given of ['incorrecto', undefined, '', 5]) {
      expect(() => guard.canActivate(contextFor(request(given)))).toThrow(ForbiddenException);
      expect(() => guard.canActivate(contextFor(request(given)))).toThrow(INVITE_REQUIRED_MESSAGE);
    }
    expect(() => guard.canActivate(contextFor({ ip: '1.1.1.1' }))).toThrow(ForbiddenException);
  });

  it('tras 10 intentos incorrectos desde una IP responde 429, incluso con el código correcto', () => {
    const guard = guardWith(CODE);
    for (let i = 0; i < 10; i++) {
      expect(() => guard.canActivate(contextFor(request('mal')))).toThrow(ForbiddenException);
    }

    let thrown: unknown;
    try {
      guard.canActivate(contextFor(request(CODE)));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    expect((thrown as HttpException).getStatus()).toBe(429);
  });

  it('el bloqueo de una IP no afecta a otra', () => {
    const guard = guardWith(CODE);
    for (let i = 0; i < 10; i++) {
      expect(() => guard.canActivate(contextFor(request('mal', '203.0.113.7')))).toThrow();
    }

    expect(guard.canActivate(contextFor(request(CODE, '203.0.113.8')))).toBe(true);
  });
});