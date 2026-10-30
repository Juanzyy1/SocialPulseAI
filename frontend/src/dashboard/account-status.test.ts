import { describe, expect, it } from 'vitest';
import { describeLastSync, statusLabel } from './account-status';

describe('statusLabel', () => {
  it('traduce cada estado a una palabra distinta', () => {
    expect(statusLabel('ACTIVE')).toBe('Activa');
    expect(statusLabel('REVOKED')).toBe('Sin acceso');
    expect(statusLabel('ERROR')).toBe('Con error');
  });
});

describe('describeLastSync', () => {
  it('una cuenta que nunca se sincronizó lo dice', () => {
    expect(describeLastSync(null)).toBe('Aún sin sincronizar');
  });

  it('una cuenta sincronizada muestra la fecha (mediodía UTC para no depender de la zona horaria)', () => {
    expect(describeLastSync('2026-10-22T12:00:00.000Z')).toBe('Sincronizada el 22 oct 2026');
  });
});