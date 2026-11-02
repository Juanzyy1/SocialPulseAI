import { helmetOptions } from './helmet-options';

describe('helmetOptions: páginas de la interfaz', () => {
  it('en producción solo admiten recursos del propio origen, sin scripts en línea ni marcos', () => {
    const options = helmetOptions(true, 'pages');

    expect(options.contentSecurityPolicy).toEqual({
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
    });
    expect(options.strictTransportSecurity).toEqual({ maxAge: 15_552_000, includeSubDomains: false });
  });

  it('en desarrollo no hay política ni HSTS', () => {
    expect(helmetOptions(false, 'pages')).toEqual({
      contentSecurityPolicy: false,
      strictTransportSecurity: false,
    });
  });

  it('sin indicar el ámbito sigue siendo la política estricta de la API', () => {
    expect(helmetOptions(true)).toEqual(helmetOptions(true, 'api'));
  });
});