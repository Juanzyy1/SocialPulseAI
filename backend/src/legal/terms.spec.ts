import { CURRENT_TERMS_VERSION, isTermsUpToDate } from './terms';

describe('términos', () => {
  it('la versión vigente es una fecha AAAA-MM-DD válida', () => {
    expect(CURRENT_TERMS_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Number.isNaN(Date.parse(CURRENT_TERMS_VERSION))).toBe(false);
  });

  it('solo la versión vigente está al día', () => {
    expect(isTermsUpToDate(CURRENT_TERMS_VERSION)).toBe(true);
    expect(isTermsUpToDate('2020-01-01')).toBe(false);
  });

  it('sin aceptación no está al día', () => {
    expect(isTermsUpToDate(null)).toBe(false);
  });
});