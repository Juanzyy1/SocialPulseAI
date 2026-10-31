export type PotentialLevel = 'low' | 'medium' | 'high';

/** Lo que debe producir un analizador. Es la ÚNICA forma que el sistema acepta de un modelo. */
export interface AnalysisDraft {
  titles: string[];
  description: string;
  hashtags: string[];
  suggestions: string[];
  /** Nivel orientativo con las razones que lo justifican. Nunca una cifra de vistas ni de seguidores. */
  potential: { level: PotentialLevel; reasons: string[] };
}

/** Lo que se guarda y se muestra: el borrador validado, más lo que añade el sistema (no el modelo). */
export interface AnalysisResult extends AnalysisDraft {
  isEstimate: true;
  disclaimer: string;
}

export const ANALYSIS_LIMITS = {
  maxTitles: 5,
  maxTitleLength: 100,
  maxDescriptionLength: 2000,
  maxHashtags: 15,
  maxHashtagLength: 50,
  maxSuggestions: 10,
  maxSuggestionLength: 300,
  maxReasons: 6,
  maxReasonLength: 300,
} as const;

export const ANALYSIS_DISCLAIMER =
  'Esta evaluación es orientativa y se basa en señales del contenido del video; no es una predicción ni garantiza resultados. El alcance real depende de factores que no podemos conocer, como el algoritmo de cada plataforma, la audiencia y el momento de publicación.';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

interface ListRules {
  min: number;
  max: number;
  maxLength: number;
}

function textList(value: unknown, path: string, rules: ListRules, problems: string[]): string[] {
  if (!Array.isArray(value)) {
    problems.push(`${path}: debe ser una lista`);
    return [];
  }
  const items = value.map((item) => (typeof item === 'string' ? item.trim() : null));
  if (items.some((item) => item === null || item === '')) {
    problems.push(`${path}: todos los elementos deben ser texto no vacío`);
  }
  const texts = items.filter((item): item is string => item !== null && item !== '');
  if (texts.length < rules.min) problems.push(`${path}: debe tener al menos ${rules.min} elemento(s)`);
  if (texts.length > rules.max) problems.push(`${path}: no puede tener más de ${rules.max} elementos`);
  texts.forEach((text, index) => {
    if (text.length > rules.maxLength) {
      problems.push(`${path}[${index}]: supera ${rules.maxLength} caracteres`);
    }
  });
  return texts;
}

const HASHTAG = /^#[\p{L}\p{N}_]+$/u;

function parseHashtags(value: unknown, problems: string[]): string[] {
  if (!Array.isArray(value)) {
    problems.push('hashtags: debe ser una lista');
    return [];
  }
  const seen = new Set<string>();
  const result: string[] = [];
  value.forEach((raw: unknown, index) => {
    if (typeof raw !== 'string') {
      problems.push(`hashtags[${index}]: debe ser texto`);
      return;
    }
    const trimmed = raw.trim();
    const tag = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    if (!HASHTAG.test(tag) || tag.length - 1 > ANALYSIS_LIMITS.maxHashtagLength) {
      problems.push(`hashtags[${index}]: formato no válido`);
      return;
    }
    const key = tag.toLowerCase();
    if (seen.has(key)) return; // se conserva la primera aparición
    seen.add(key);
    result.push(tag);
  });
  if (result.length > ANALYSIS_LIMITS.maxHashtags) {
    problems.push(`hashtags: no puede tener más de ${ANALYSIS_LIMITS.maxHashtags} elementos`);
  }
  return result;
}

export type DraftValidation = { ok: true; draft: AnalysisDraft } | { ok: false; problems: string[] };

/**
 * Valida la respuesta cruda de un modelo y construye el borrador desde cero: los campos que el modelo
 * añada por su cuenta (por ejemplo, una "probabilidad de viralidad") se descartan.
 */
export function validateDraft(raw: unknown): DraftValidation {
  if (!isRecord(raw)) return { ok: false, problems: ['La respuesta del análisis debe ser un objeto'] };

  const problems: string[] = [];
  const titles = textList(
    raw.titles,
    'titles',
    { min: 1, max: ANALYSIS_LIMITS.maxTitles, maxLength: ANALYSIS_LIMITS.maxTitleLength },
    problems,
  );

  const description = typeof raw.description === 'string' ? raw.description.trim() : '';
  if (description === '') problems.push('description: debe ser un texto no vacío');
  else if (description.length > ANALYSIS_LIMITS.maxDescriptionLength) {
    problems.push(`description: supera ${ANALYSIS_LIMITS.maxDescriptionLength} caracteres`);
  }

  const hashtags = parseHashtags(raw.hashtags, problems);
  const suggestions = textList(
    raw.suggestions,
    'suggestions',
    { min: 0, max: ANALYSIS_LIMITS.maxSuggestions, maxLength: ANALYSIS_LIMITS.maxSuggestionLength },
    problems,
  );

  let level: PotentialLevel = 'low';
  let reasons: string[] = [];
  if (!isRecord(raw.potential)) {
    problems.push('potential: debe ser un objeto');
  } else {
    const candidate = raw.potential.level;
    if (candidate === 'low' || candidate === 'medium' || candidate === 'high') level = candidate;
    else problems.push("potential.level: debe ser 'low', 'medium' o 'high'");
    reasons = textList(
      raw.potential.reasons,
      'potential.reasons',
      { min: 1, max: ANALYSIS_LIMITS.maxReasons, maxLength: ANALYSIS_LIMITS.maxReasonLength },
      problems,
    );
  }

  if (problems.length > 0) return { ok: false, problems };
  return { ok: true, draft: { titles, description, hashtags, suggestions, potential: { level, reasons } } };
}

/**
 * Promesas que la IA no debe hacer. Se busca sobre el texto sin tildes y en minúsculas. Es una red de
 * seguridad por patrones, no una garantía: el control principal es el diseño del resultado (sin cifras de
 * alcance, con razones obligatorias) y las instrucciones al modelo.
 */
const FORBIDDEN: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  { label: 'promesa de viralidad', pattern: /\bviral\w*/ },
  { label: 'garantía de resultados', pattern: /\bgarantiz\w*|\bgarantia\b|\bguarantee\w*/ },
  { label: 'certeza sobre el resultado', pattern: /\bsin duda\b|\bcon certeza\b|\bes seguro que\b|\bsera un exito\b/ },
  { label: 'porcentaje de certeza', pattern: /\b100 ?%/ },
  { label: 'éxito asegurado', pattern: /\bexito (rotundo|asegurado|garantizado|seguro)\b/ },
  {
    label: 'cifra de resultados prevista',
    pattern:
      /\b\d[\d.,]*\s*(k|mil|m|millon(es)?)?\s*(de\s+)?(vistas|views|visualizaciones|reproducciones|seguidores|suscriptores|likes|me gusta)\b/,
  },
];

function normalize(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Etiquetas de las promesas prohibidas que contiene un texto (vacío si no hay ninguna). */
export function findForbiddenClaims(text: string): string[] {
  const normalized = normalize(text);
  return FORBIDDEN.filter(({ pattern }) => pattern.test(normalized)).map(({ label }) => label);
}

export type GuardResult =
  | { ok: true; draft: AnalysisDraft; removedHashtags: string[] }
  | { ok: false; violations: string[] };

/**
 * Un texto con una promesa prohibida invalida el análisis. Un hashtag prohibido (por ejemplo #viral) solo
 * se elimina y se informa: es una costumbre frecuente de los modelos y no una promesa en sí.
 */
export function applyGuardrails(draft: AnalysisDraft): GuardResult {
  const violations: string[] = [];
  const scan = (path: string, text: string) => {
    for (const label of findForbiddenClaims(text)) violations.push(`${path}: ${label}`);
  };
  draft.titles.forEach((text, index) => scan(`titles[${index}]`, text));
  scan('description', draft.description);
  draft.suggestions.forEach((text, index) => scan(`suggestions[${index}]`, text));
  draft.potential.reasons.forEach((text, index) => scan(`potential.reasons[${index}]`, text));
  if (violations.length > 0) return { ok: false, violations };

  const removedHashtags = draft.hashtags.filter((tag) => findForbiddenClaims(tag.slice(1)).length > 0);
  return {
    ok: true,
    draft: { ...draft, hashtags: draft.hashtags.filter((tag) => !removedHashtags.includes(tag)) },
    removedHashtags,
  };
}

export type FinalizeResult =
  | { ok: true; result: AnalysisResult; removedHashtags: string[] }
  | { ok: false; code: 'INVALID_FORMAT' | 'FORBIDDEN_CLAIMS'; problems: string[] };

/** Único camino para convertir la respuesta de un modelo en algo que se guarda y se muestra. */
export function finalizeAnalysis(raw: unknown): FinalizeResult {
  const parsed = validateDraft(raw);
  if (!parsed.ok) return { ok: false, code: 'INVALID_FORMAT', problems: parsed.problems };

  const guarded = applyGuardrails(parsed.draft);
  if (!guarded.ok) return { ok: false, code: 'FORBIDDEN_CLAIMS', problems: guarded.violations };

  return {
    ok: true,
    result: { ...guarded.draft, isEstimate: true, disclaimer: ANALYSIS_DISCLAIMER },
    removedHashtags: guarded.removedHashtags,
  };
}