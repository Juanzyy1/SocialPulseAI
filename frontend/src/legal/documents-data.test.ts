import { describe, expect, it } from 'vitest';
import { CONTACT_EMAIL, GOVERNING_COUNTRY, LEGAL_RESPONSIBLE, MIN_AGE } from '../config/legal';
import { PRIVACY_DOCUMENT, TERMS_DOCUMENT, placeholdersIn } from './documents';

const textOf = (doc: typeof TERMS_DOCUMENT) => JSON.stringify(doc);

describe('datos legales en los documentos', () => {
  it('los datos de config/legal.ts son plausibles', () => {
    expect(CONTACT_EMAIL).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    expect(Number.isInteger(MIN_AGE)).toBe(true);
    expect(MIN_AGE).toBeGreaterThanOrEqual(13);
    expect(LEGAL_RESPONSIBLE.trim()).not.toBe('');
    expect(GOVERNING_COUNTRY.trim()).not.toBe('');
  });

  it('los términos nombran al responsable, el correo, la edad mínima y la ley aplicable', () => {
    const text = textOf(TERMS_DOCUMENT);

    expect(text).toContain(LEGAL_RESPONSIBLE);
    expect(text).toContain(CONTACT_EMAIL);
    expect(text).toContain(`al menos ${MIN_AGE} años`);
    expect(text).toContain(GOVERNING_COUNTRY);
  });

  it('la política nombra al responsable, el correo y a la autoridad que vigila la protección de datos', () => {
    const text = textOf(PRIVACY_DOCUMENT);

    expect(text).toContain(LEGAL_RESPONSIBLE);
    expect(text).toContain(CONTACT_EMAIL);
    expect(text).toContain('Superintendencia de Industria y Comercio');
  });

  it('la política declara las finalidades y que no se venden ni comparten los datos con fines comerciales', () => {
    const text = textOf(PRIVACY_DOCUMENT);

    expect(text).toContain('Para qué usamos tus datos');
    expect(text).toContain('No vendemos tus datos ni los compartimos con terceros con fines comerciales');
  });

  it('la política nombra al proveedor de alojamiento y avisa de que los datos salen de Colombia', () => {
    const text = textOf(PRIVACY_DOCUMENT);

    expect(text).toContain('Render');
    expect(text).toContain('Oregón');
    expect(text).toContain('fuera de Colombia');
  });

  it('ya no dicen que faltan funciones que existen (eliminar la cuenta, limpiar sesiones)', () => {
    for (const doc of [TERMS_DOCUMENT, PRIVACY_DOCUMENT]) {
      const text = textOf(doc);

      expect(text).not.toContain('no incluye un botón');
      expect(text).not.toContain('Por ahora no hay un botón');
      expect(text).not.toContain('se eliminan periódicamente]');
    }
    expect(textOf(TERMS_DOCUMENT)).toContain('desde Ajustes');
    expect(textOf(PRIVACY_DOCUMENT)).toContain('desde Ajustes');
  });

  it('ningún marcador pendiente queda sin explicar qué falta', () => {
    for (const doc of [TERMS_DOCUMENT, PRIVACY_DOCUMENT]) {
      for (const marker of placeholdersIn(doc)) {
        expect(marker.length).toBeGreaterThan('[COMPLETAR: ]'.length + 10);
      }
    }
  });
});