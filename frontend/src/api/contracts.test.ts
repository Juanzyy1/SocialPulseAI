import { describe, expect, it } from 'vitest';
import accountAnalytics from './contracts/account-analytics.json';
import authUser from './contracts/auth-user.json';
import catalog from './contracts/catalog.json';
import compare from './contracts/compare.json';
import disconnect from './contracts/disconnect.json';
import overview from './contracts/overview.json';
import profile from './contracts/profile.json';
import socialAccount from './contracts/social-account.json';
import syncRun from './contracts/sync-run.json';
import type { Widen } from './contracts/widen';
import type {
  AccountAnalytics,
  AuthUser,
  CatalogResponse,
  ComparisonResponse,
  DisconnectResult,
  OverviewResponse,
  Profile,
  SocialAccount,
  SyncRun,
} from './types';

/**
 * Falla al COMPILAR (npm run build) si el JSON no cumple el tipo. El valor devuelto solo evita
 * variables sin uso: lo que importa es la comprobación de tipos.
 */
function conforms<T>(_fixture: Widen<T>): true {
  return true;
}

describe('contrato entre el backend y los tipos del frontend', () => {
  it('cada JSON del contrato cumple el tipo que el frontend declara (se comprueba al compilar)', () => {
    const results = [
      conforms<AuthUser>(authUser),
      conforms<Profile>(profile),
      conforms<SocialAccount>(socialAccount),
      conforms<SyncRun>(syncRun),
      conforms<DisconnectResult>(disconnect),
      conforms<CatalogResponse>(catalog),
      conforms<ComparisonResponse>(compare),
      conforms<AccountAnalytics>(accountAnalytics),
      conforms<OverviewResponse>(overview),
    ];

    expect(results).toHaveLength(9);
    expect(results.every(Boolean)).toBe(true);
  });

  it('la comprobación rechaza un campo faltante, un tipo distinto y un nulo donde no se admite', () => {
    // @ts-expect-error falta el campo email
    conforms<AuthUser>({ id: 'x', displayName: null, createdAt: 'x' });
    // @ts-expect-error id debe ser texto
    conforms<AuthUser>({ id: 1, email: 'x', displayName: null, createdAt: 'x' });
    // @ts-expect-error email no admite null
    conforms<AuthUser>({ id: 'x', email: null, displayName: null, createdAt: 'x' });

    // Los textos de las uniones (por ejemplo, platform) se ensanchan a string: se admiten.
    expect(conforms<SocialAccount>(socialAccount)).toBe(true);
  });
});