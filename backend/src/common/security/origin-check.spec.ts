import { isOriginAllowed, OriginCheckInput } from './origin-check';

const FRONT = 'http://localhost:5173';
const HOST = 'http://localhost:3000';

const check = (overrides: Partial<OriginCheckInput>) =>
  isOriginAllowed({
    method: 'POST',
    origin: undefined,
    hostOrigin: HOST,
    frontendOrigin: FRONT,
    ...overrides,
  });

describe('isOriginAllowed', () => {
  it('las peticiones de solo lectura pasan con cualquier origen', () => {
    for (const method of ['GET', 'HEAD', 'OPTIONS', 'get']) {
      expect(check({ method, origin: 'http://evil.example' })).toBe(true);
    }
  });

  it('una petición que modifica datos sin encabezado Origin pasa (cliente que no es una página)', () => {
    expect(check({ origin: undefined })).toBe(true);
  });

  it('acepta el origen del propio servidor', () => {
    expect(check({ origin: HOST })).toBe(true);
  });

  it('acepta el origen del frontend configurado', () => {
    expect(check({ origin: FRONT })).toBe(true);
  });

  it('rechaza un origen ajeno en POST, PATCH, PUT y DELETE', () => {
    for (const method of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      expect(check({ method, origin: 'http://evil.example' })).toBe(false);
    }
  });

  it('rechaza Origin "null" y orígenes que solo se parecen al permitido', () => {
    expect(check({ origin: 'null' })).toBe(false);
    expect(check({ origin: 'http://localhost:5174' })).toBe(false);
    expect(check({ origin: 'https://localhost:5173' })).toBe(false);
    expect(check({ origin: `${FRONT}.evil.example` })).toBe(false);
  });

  it('sin frontend configurado, el origen del frontend no se acepta', () => {
    expect(check({ origin: FRONT, frontendOrigin: null })).toBe(false);
    expect(check({ origin: HOST, frontendOrigin: null })).toBe(true);
  });
});