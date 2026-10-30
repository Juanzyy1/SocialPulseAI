import { describe, expect, it } from 'vitest';
import type { SocialAccount } from '../api/types';
import {
  accountLabel,
  accountStatusNotice,
  pickAccount,
  platformLabel,
  withAccount,
} from './account-params';

const account = (id: string, overrides: Partial<SocialAccount> = {}): SocialAccount => ({
  id,
  platform: 'YOUTUBE',
  platformAccountId: `canal-${id}`,
  displayName: `Canal ${id}`,
  handle: `@canal${id}`,
  avatarUrl: null,
  status: 'ACTIVE',
  connectedAt: '2026-10-18T00:00:00.000Z',
  lastSyncedAt: null,
  ...overrides,
});

describe('pickAccount', () => {
  const accounts = [account('a'), account('b')];

  it('sin cuentas devuelve null', () => {
    expect(pickAccount([], 'a')).toBeNull();
    expect(pickAccount([], null)).toBeNull();
  });

  it('devuelve la cuenta pedida si existe', () => {
    expect(pickAccount(accounts, 'b')?.id).toBe('b');
  });

  it('si la pedida no existe o no se pide ninguna, devuelve la primera', () => {
    expect(pickAccount(accounts, 'inexistente')?.id).toBe('a');
    expect(pickAccount(accounts, null)?.id).toBe('a');
    expect(pickAccount(accounts, '')?.id).toBe('a');
  });
});

describe('withAccount', () => {
  it('añade o reemplaza la cuenta y conserva el periodo', () => {
    const result = withAccount(new URLSearchParams('period=7d&account=a'), 'b');

    expect(result.get('account')).toBe('b');
    expect(result.get('period')).toBe('7d');
  });

  it('no modifica los parámetros originales', () => {
    const original = new URLSearchParams('account=a');

    withAccount(original, 'b');

    expect(original.get('account')).toBe('a');
  });
});

describe('accountLabel y platformLabel', () => {
  it('usa el nombre, luego el alias y luego el identificador', () => {
    expect(accountLabel(account('a'))).toBe('Canal a');
    expect(accountLabel(account('a', { displayName: null }))).toBe('@canala');
    expect(accountLabel(account('a', { displayName: null, handle: null }))).toBe('canal-a');
  });

  it('un nombre en blanco cuenta como ausente', () => {
    expect(accountLabel(account('a', { displayName: '   ' }))).toBe('@canala');
  });

  it('traduce las plataformas conocidas y deja las desconocidas tal cual', () => {
    expect(platformLabel('YOUTUBE')).toBe('YouTube');
    expect(platformLabel('OTRA')).toBe('OTRA');
  });
});

describe('accountStatusNotice', () => {
  it('una cuenta activa no lleva aviso', () => {
    expect(accountStatusNotice('ACTIVE')).toBeNull();
  });

  it('una cuenta revocada o con error avisa y aclara que se muestran datos guardados', () => {
    expect(accountStatusNotice('REVOKED')).toContain('revocado');
    expect(accountStatusNotice('REVOKED')).toContain('datos guardados');
    expect(accountStatusNotice('ERROR')).toContain('problema');
  });
});