import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CURRENT_TERMS_VERSION } from './terms';

// Repositorio con backend/ y frontend/ lado a lado. Este archivo está en backend/src/legal.
const FRONTEND_TERMS_FILE = join(__dirname, '..', '..', '..', 'frontend', 'src', 'legal', 'terms.ts');

describe('versión de los términos: backend y frontend', () => {
  const source = readFileSync(FRONTEND_TERMS_FILE, 'utf8');
  const matches = [...source.matchAll(/export const TERMS_VERSION\s*=\s*'(\d{4}-\d{2}-\d{2})'/g)];

  it('el frontend declara exactamente una versión de los términos', () => {
    expect(matches).toHaveLength(1);
  });

  it('coincide con la versión vigente del backend', () => {
    expect(matches[0]?.[1]).toBe(CURRENT_TERMS_VERSION);
  });
});