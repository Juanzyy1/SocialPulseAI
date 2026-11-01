import { helmetOptions } from './helmet-options';

describe('helmetOptions', () => {
  it('en producción: política de contenido estricta y HSTS de 180 días sin subdominios', () => {
    expect(helmetOptions(true)).toEqual({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] },
      },
      strictTransportSecurity: { maxAge: 15_552_000, includeSubDomains: false },
    });
  });

  it('en desarrollo: sin política de contenido (Swagger) y sin HSTS (localhost)', () => {
    expect(helmetOptions(false)).toEqual({
      contentSecurityPolicy: false,
      strictTransportSecurity: false,
    });
  });
});