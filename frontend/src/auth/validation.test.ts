import { describe, expect, it } from 'vitest';
import { loginErrors, registerErrors } from './validation';
import type { RegisterForm } from './validation';

const valid: RegisterForm = {
  displayName: 'Ana',
  email: 'ana@example.com',
  password: 'una-clave-larga-1234',
  acceptTerms: true,
};

describe('registerErrors', () => {
  it('un formulario válido no tiene errores', () => {
    expect(registerErrors(valid)).toEqual({});
  });

  it('un formulario vacío marca los cuatro campos', () => {
    const errors = registerErrors({ displayName: '', email: '', password: '', acceptTerms: false });

    expect(Object.keys(errors).sort()).toEqual(['acceptTerms', 'displayName', 'email', 'password']);
  });

  it('rechaza correos con formato inválido y acepta los válidos con espacios alrededor', () => {
    for (const bad of ['ana', 'ana@', '@example.com', 'ana@example', 'a na@example.com']) {
      expect(registerErrors({ ...valid, email: bad }).email).toBe('Escribe un correo válido');
    }
    expect(registerErrors({ ...valid, email: '  ana@example.com  ' })).toEqual({});
  });

  it('rechaza un correo de más de 254 caracteres', () => {
    const long = `${'a'.repeat(250)}@b.co`;

    expect(registerErrors({ ...valid, email: long }).email).toContain('254');
  });

  it('la contraseña debe tener entre 12 y 128 caracteres, y los espacios cuentan', () => {
    expect(registerErrors({ ...valid, password: 'a'.repeat(11) }).password).toContain('al menos 12');
    expect(registerErrors({ ...valid, password: 'a'.repeat(12) }).password).toBeUndefined();
    expect(registerErrors({ ...valid, password: 'a'.repeat(128) }).password).toBeUndefined();
    expect(registerErrors({ ...valid, password: 'a'.repeat(129) }).password).toContain('128');
    expect(registerErrors({ ...valid, password: ' '.repeat(12) }).password).toBeUndefined();
  });

  it('el nombre es obligatorio y admite hasta 80 caracteres', () => {
    expect(registerErrors({ ...valid, displayName: '   ' }).displayName).toBe('Escribe tu nombre');
    expect(registerErrors({ ...valid, displayName: 'a'.repeat(80) }).displayName).toBeUndefined();
    expect(registerErrors({ ...valid, displayName: 'a'.repeat(81) }).displayName).toContain('80');
  });

  it('hay que aceptar los términos', () => {
    expect(registerErrors({ ...valid, acceptTerms: false }).acceptTerms).toContain('términos');
  });
});

describe('loginErrors', () => {
  it('solo exige correo y contraseña, sin mínimo de longitud', () => {
    expect(loginErrors({ email: 'ana@example.com', password: 'x' })).toEqual({});
    expect(Object.keys(loginErrors({ email: '', password: '' })).sort()).toEqual(['email', 'password']);
  });

  it('rechaza una contraseña de más de 128 caracteres', () => {
    expect(loginErrors({ email: 'ana@example.com', password: 'a'.repeat(129) }).password).toContain('128');
  });
});