import { ANALYSIS_DISCLAIMER, finalizeAnalysis, findForbiddenClaims } from './analysis-result';

const valid = (): Record<string, unknown> => ({
  titles: ['Tres trucos para editar más rápido'],
  description: 'En este video te muestro tres trucos de edición para ahorrar tiempo.',
  hashtags: ['#edicion', 'tips'],
  suggestions: ['Muestra el resultado final en los primeros segundos'],
  potential: { level: 'medium', reasons: ['El gancho aparece en los primeros 3 segundos'] },
});

describe('finalizeAnalysis: forma de la respuesta', () => {
  it('un análisis válido se acepta y el sistema añade la marca de estimación y el aviso', () => {
    const out = finalizeAnalysis(valid());

    expect(out.ok).toBe(true);
    if (!out.ok) throw new Error('Debía aceptarse');
    expect(out.result.isEstimate).toBe(true);
    expect(out.result.disclaimer).toBe(ANALYSIS_DISCLAIMER);
    expect(out.result.hashtags).toEqual(['#edicion', '#tips']);
    expect(out.result.potential).toEqual({
      level: 'medium',
      reasons: ['El gancho aparece en los primeros 3 segundos'],
    });
    expect(out.removedHashtags).toEqual([]);
  });

  it('el aviso es orientativo y aclara que no es una predicción', () => {
    expect(ANALYSIS_DISCLAIMER).toContain('orientativa');
    expect(ANALYSIS_DISCLAIMER).toContain('no es una predicción');
  });

  it('descarta los campos que el modelo añade por su cuenta, incluidos los que intentan cambiar la marca o el aviso', () => {
    const raw = {
      ...valid(),
      viralProbability: 0.93,
      isEstimate: false,
      disclaimer: 'Resultados garantizados',
      potential: { level: 'high', reasons: ['Buen gancho'], expectedViews: 1_000_000 },
    };

    const out = finalizeAnalysis(raw);

    if (!out.ok) throw new Error('Debía aceptarse');
    expect(Object.keys(out.result).sort()).toEqual([
      'description',
      'disclaimer',
      'hashtags',
      'isEstimate',
      'potential',
      'suggestions',
      'titles',
    ]);
    expect(Object.keys(out.result.potential).sort()).toEqual(['level', 'reasons']);
    expect(out.result.isEstimate).toBe(true);
    expect(out.result.disclaimer).toBe(ANALYSIS_DISCLAIMER);
  });

  it('recorta los textos y elimina hashtags repetidos sin distinguir mayúsculas, conservando el primero', () => {
    const out = finalizeAnalysis({
      ...valid(),
      titles: ['  Un título  '],
      hashtags: ['#Tips', '#tips', ' tips '],
    });

    if (!out.ok) throw new Error('Debía aceptarse');
    expect(out.result.titles).toEqual(['Un título']);
    expect(out.result.hashtags).toEqual(['#Tips']);
  });

  it.each([[null], ['texto'], [[]], [42]])('una respuesta que no es un objeto (%j) se rechaza', (raw) => {
    const out = finalizeAnalysis(raw);

    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('Debía rechazarse');
    expect(out.code).toBe('INVALID_FORMAT');
  });

  const INVALID: Array<[string, (raw: Record<string, unknown>) => void, string]> = [
    ['sin títulos', (r) => { delete r.titles; }, 'titles'],
    ['una lista de títulos vacía', (r) => { r.titles = []; }, 'titles'],
    ['más de 5 títulos', (r) => { r.titles = ['a', 'b', 'c', 'd', 'e', 'f']; }, 'titles'],
    ['un título de 101 caracteres', (r) => { r.titles = ['a'.repeat(101)]; }, 'titles[0]'],
    ['un título en blanco', (r) => { r.titles = ['   ']; }, 'titles'],
    ['sin descripción', (r) => { delete r.description; }, 'description'],
    ['una descripción de 2001 caracteres', (r) => { r.description = 'a'.repeat(2001); }, 'description'],
    ['hashtags que no es una lista', (r) => { r.hashtags = '#a #b'; }, 'hashtags'],
    ['un hashtag con espacios', (r) => { r.hashtags = ['con espacio']; }, 'hashtags[0]'],
    ['más de 15 hashtags', (r) => { r.hashtags = Array.from({ length: 16 }, (_, i) => `#tag${i}`); }, 'hashtags'],
    ['sugerencias que no son texto', (r) => { r.suggestions = [5]; }, 'suggestions'],
    ['más de 10 sugerencias', (r) => { r.suggestions = Array.from({ length: 11 }, (_, i) => `s${i}`); }, 'suggestions'],
    ['sin potencial', (r) => { delete r.potential; }, 'potential'],
    ['un nivel de potencial desconocido', (r) => { r.potential = { level: 'alto', reasons: ['x'] }; }, 'potential.level'],
    ['un potencial sin razones', (r) => { r.potential = { level: 'low', reasons: [] }; }, 'potential.reasons'],
  ];

  it.each(INVALID)('rechaza %s', (_name, mutate, path) => {
    const raw = valid();
    mutate(raw);

    const out = finalizeAnalysis(raw);

    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('Debía rechazarse');
    expect(out.code).toBe('INVALID_FORMAT');
    expect(out.problems.some((problem) => problem.startsWith(path))).toBe(true);
  });

  it('informa varios problemas a la vez', () => {
    const out = finalizeAnalysis({ titles: [], description: '', hashtags: 'x', suggestions: [], potential: null });

    if (out.ok) throw new Error('Debía rechazarse');
    expect(out.problems.length).toBeGreaterThanOrEqual(4);
  });
});

describe('finalizeAnalysis: promesas prohibidas', () => {
  const CASES: Array<[string, (raw: Record<string, unknown>) => void, string]> = [
    ['un título', (r) => { r.titles = ['Cómo hacer que tu video sea viral']; }, 'titles[0]: promesa de viralidad'],
    ['la descripción', (r) => { r.description = 'Con esta técnica el éxito está garantizado.'; }, 'description: garantía de resultados'],
    [
      'una sugerencia',
      (r) => { r.suggestions = ['Publica a las 8 pm y tendrás 100k vistas']; },
      'suggestions[0]: cifra de resultados prevista',
    ],
    [
      'una razón del potencial',
      (r) => { r.potential = { level: 'high', reasons: ['Sin duda será un éxito'] }; },
      'potential.reasons[0]: certeza sobre el resultado',
    ],
  ];

  it.each(CASES)('se rechaza una promesa en %s', (_name, mutate, expected) => {
    const raw = valid();
    mutate(raw);

    const out = finalizeAnalysis(raw);

    expect(out.ok).toBe(false);
    if (out.ok) throw new Error('Debía rechazarse');
    expect(out.code).toBe('FORBIDDEN_CLAIMS');
    expect(out.problems).toContain(expected);
  });

  it('un hashtag prohibido se elimina y se informa, sin invalidar el análisis', () => {
    const out = finalizeAnalysis({ ...valid(), hashtags: ['#viral', '#edicion', '#Viralidad'] });

    if (!out.ok) throw new Error('Debía aceptarse');
    expect(out.result.hashtags).toEqual(['#edicion']);
    expect(out.removedHashtags).toEqual(['#viral', '#Viralidad']);
  });

  it('un texto con cifras que no son resultados (segundos, cortes) se acepta', () => {
    const out = finalizeAnalysis({
      ...valid(),
      description: 'Muestra el antes y el después en los primeros 3 segundos; el video dura 45 segundos y tiene 2 cortes.',
    });

    expect(out.ok).toBe(true);
  });
});

describe('findForbiddenClaims', () => {
  it.each([
    ['Será VIRAL', ['promesa de viralidad']],
    ['Intenta viralizar el video', ['promesa de viralidad']],
    ['Resultados garantizados', ['garantía de resultados']],
    ['GARANTÍA total', ['garantía de resultados']],
    ['This is guaranteed to work', ['garantía de resultados']],
    ['Sin Duda funcionará', ['certeza sobre el resultado']],
    ['Es seguro que funcionará', ['certeza sobre el resultado']],
    ['Efectividad del 100%', ['porcentaje de certeza']],
    ['Funciona al 100 %', ['porcentaje de certeza']],
    ['Un éxito rotundo', ['éxito asegurado']],
    ['Conseguirás 1.5 millones de vistas', ['cifra de resultados prevista']],
    ['Subió a 50k views', ['cifra de resultados prevista']],
    ['Viral, viral y garantizado', ['promesa de viralidad', 'garantía de resultados']],
  ])('detecta «%s»', (text, labels) => {
    expect(findForbiddenClaims(text)).toEqual(labels);
  });

  it.each([
    ['Buen ritmo en los primeros 3 segundos'],
    ['El video dura 45 segundos'],
    ['Incluye 2 cortes y 1 transición'],
    ['La iluminación es clara y el audio se entiende'],
    ['El viraje de color es sutil'],
    ['Antiviral'],
  ])('no marca «%s»', (text) => {
    expect(findForbiddenClaims(text)).toEqual([]);
  });
});