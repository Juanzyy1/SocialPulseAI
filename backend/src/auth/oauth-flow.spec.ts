import {
  codeChallengeFor,
  createOAuthTransaction,
  packOAuthCookie,
  safeEqual,
  unpackOAuthCookie,
} from './oauth-flow';

describe('oauth-flow', () => {
  it('calcula el desafío PKCE S256 (vector del apéndice B del RFC 7636)', () => {
    expect(codeChallengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('genera valores aleatorios, distintos y largos', () => {
    const a = createOAuthTransaction();
    const b = createOAuthTransaction();
    expect(a.state).not.toBe(b.state);
    expect(a.codeVerifier).not.toBe(b.codeVerifier);
    expect(a.state.length).toBeGreaterThanOrEqual(43);
    expect(a.codeVerifier.length).toBeGreaterThanOrEqual(43);
    expect(a.codeChallenge).toBe(codeChallengeFor(a.codeVerifier));
  });

  it('empaqueta y desempaqueta la cookie del flujo', () => {
    const t = createOAuthTransaction();
    expect(unpackOAuthCookie(packOAuthCookie(t))).toEqual({
      state: t.state,
      nonce: t.nonce,
      codeVerifier: t.codeVerifier,
    });
  });

  it('rechaza cookies mal formadas', () => {
    for (const bad of ['', 'a', 'a.b', 'a.b.c.d', 'a..c']) {
      expect(unpackOAuthCookie(bad)).toBeNull();
    }
  });

  it('safeEqual compara valores y longitudes', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});