import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import { describeAuthError } from './auth-errors';
import { buildRegisterInput } from './auth-flows';
import { registerErrors } from './validation';

const form = { displayName: 'Ana', email: 'ana@example.com', password: 'una-clave-larga-1234', acceptTerms: true };

describe('código de invitación en el registro', () => {
  it('se incluye recortado si se escribió, y se omite si está vacío o ausente', () => {
    expect(buildRegisterInput({ ...form, inviteCode: ' abc ' })).toHaveProperty('inviteCode', 'abc');
    expect(buildRegisterInput({ ...form, inviteCode: '   ' })).not.toHaveProperty('inviteCode');
    expect(buildRegisterInput(form)).not.toHaveProperty('inviteCode');
  });

  it('es opcional en la validación, con un máximo de 64 caracteres', () => {
    expect(registerErrors({ ...form, inviteCode: '' })).toEqual({});
    expect(registerErrors({ ...form, inviteCode: 'a'.repeat(64) })).toEqual({});
    expect(registerErrors({ ...form, inviteCode: 'a'.repeat(65) }).inviteCode).toContain('64');
  });

  it('un 403 de invitación en el registro da su aviso; otro 403, el genérico', () => {
    const invite = new ApiError(403, 'Se necesita un código de invitación válido');

    expect(describeAuthError(invite, 'register')).toBe(
      'El código de invitación no es correcto o falta. Pídeselo a quien te invitó.',
    );
    expect(describeAuthError(new ApiError(403, 'Origen no permitido'), 'register')).toContain('Recarga la página');
    expect(describeAuthError(invite, 'login')).toContain('Recarga la página');
  });
});