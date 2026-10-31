/**
 * Compara una respuesta real con un ejemplo del contrato (lo que el frontend declara necesitar).
 * Devuelve la lista de problemas; vacía significa que la respuesta cumple el contrato.
 * - Los campos del ejemplo deben existir en la respuesta; los campos extra de la respuesta se permiten.
 * - Un null en el ejemplo significa "campo anulable": admite cualquier valor.
 * - Un valor no nulo en el ejemplo exige el mismo tipo en la respuesta (un null no vale).
 * - De un arreglo solo se compara el primer elemento; un ejemplo vacío no verifica nada.
 */
export function shapeProblems(actual: unknown, expected: unknown, path = '$'): string[] {
  if (expected === null) return [];

  if (Array.isArray(expected)) {
    if (!Array.isArray(actual)) return [`${path}: se esperaba un arreglo`];
    if (expected.length === 0) return [];
    if (actual.length === 0) {
      return [`${path}: el arreglo está vacío y no se puede verificar su contenido`];
    }
    return shapeProblems(actual[0], expected[0], `${path}[0]`);
  }

  if (typeof expected === 'object') {
    if (typeof actual !== 'object' || actual === null || Array.isArray(actual)) {
      return [`${path}: se esperaba un objeto`];
    }
    const record = actual as Record<string, unknown>;
    return Object.entries(expected as Record<string, unknown>).flatMap(([key, value]) =>
      key in record
        ? shapeProblems(record[key], value, `${path}.${key}`)
        : [`${path}.${key}: falta el campo`],
    );
  }

  if (typeof actual !== typeof expected) {
    return [
      `${path}: se esperaba ${typeof expected} y llegó ${actual === null ? 'null' : typeof actual}`,
    ];
  }
  return [];
}