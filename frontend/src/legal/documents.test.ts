import { describe, expect, it } from 'vitest';
import {
  LEGAL_REVIEWED,
  PRIVACY_DOCUMENT,
  TERMS_DOCUMENT,
  placeholdersIn,
  splitPlaceholders,
} from './documents';
import { TERMS_VERSION } from './terms';

const DOCUMENTS = [TERMS_DOCUMENT, PRIVACY_DOCUMENT];

describe('documentos legales', () => {
  it('ambos documentos declaran la versión vigente de los términos', () => {
    for (const doc of DOCUMENTS) expect(doc.version).toBe(TERMS_VERSION);
  });

  it('cada documento tiene secciones con id único, encabezado y contenido no vacío', () => {
    for (const doc of DOCUMENTS) {
      const ids = doc.sections.map((section) => section.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(doc.sections.length).toBeGreaterThan(0);

      for (const section of doc.sections) {
        expect(section.heading.trim()).not.toBe('');
        expect(section.blocks.length).toBeGreaterThan(0);
        for (const block of section.blocks) {
          if (block.type === 'p') expect(block.text.trim()).not.toBe('');
          else {
            expect(block.items.length).toBeGreaterThan(0);
            for (const item of block.items) expect(item.trim()).not.toBe('');
          }
        }
      }
    }
  });

  it('LEGAL_REVIEWED solo es true cuando no queda ningún marcador pendiente (y al revés)', () => {
    const pending = DOCUMENTS.flatMap((doc) => placeholdersIn(doc));

    if (LEGAL_REVIEWED) expect(pending).toEqual([]);
    else expect(pending.length).toBeGreaterThan(0);
  });

  it('placeholdersIn encuentra los marcadores de un documento', () => {
    const doc = {
      title: 'x',
      version: '1',
      sections: [
        {
          id: 'a',
          heading: 'A',
          blocks: [
            { type: 'p' as const, text: 'Escribe a [COMPLETAR: correo] hoy.' },
            { type: 'ul' as const, items: ['sin marcador', '[COMPLETAR: otro]'] },
          ],
        },
      ],
    };

    expect(placeholdersIn(doc)).toEqual(['[COMPLETAR: correo]', '[COMPLETAR: otro]']);
  });

  it('splitPlaceholders separa el texto de los marcadores', () => {
    expect(splitPlaceholders('Escribe a [COMPLETAR: correo] o a [COMPLETAR: otro].')).toEqual([
      { text: 'Escribe a ', placeholder: false },
      { text: '[COMPLETAR: correo]', placeholder: true },
      { text: ' o a ', placeholder: false },
      { text: '[COMPLETAR: otro]', placeholder: true },
      { text: '.', placeholder: false },
    ]);
    expect(splitPlaceholders('Sin marcadores')).toEqual([{ text: 'Sin marcadores', placeholder: false }]);
  });

  it('la política de privacidad nombra las cookies que usa la aplicación', () => {
    const text = JSON.stringify(PRIVACY_DOCUMENT);

    for (const cookie of ['sp_session', 'sp_oauth', 'sp_yt_oauth']) {
      expect(text).toContain(cookie);
    }
  });
});